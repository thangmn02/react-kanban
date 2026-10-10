"""Bounded server-only Lead Pulse, independent of the rejected note trackers."""
from __future__ import annotations
import hashlib
import json
import math
import time
import numpy as np

VERSION = "lead-pulse-v1"
SOURCES = ("vocals", "piano", "guitar", "other")
# Freeze this one candidate before holdout evaluation. Scores are evidence, not accuracy.
POLICY = {"passageSeconds": 2.0, "hopSeconds": .01, "frameSamples": 2048,
          "absoluteRmsFloor": .001, "minimumScore": .36, "ambiguityMargin": .06,
          "switchPenalty": .16, "vocalSpacing": .14, "noteSpacing": .10,
          "minimumBodySeconds": .07}


def mono(value):
    value = np.asarray(value, dtype=np.float32)
    if value.ndim == 2:
        value = value.mean(axis=1)
    if value.ndim != 1 or not np.all(np.isfinite(value)):
        raise ValueError("invalid_lead_audio")
    return value


def features(signal, rate):
    signal = mono(signal)
    hop = max(1, round(rate * POLICY["hopSeconds"]))
    size = POLICY["frameSamples"]
    padded = np.pad(signal, (size//2, size//2))
    frames = np.lib.stride_tricks.sliding_window_view(padded, size)[::hop]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(size)))
    frequencies = np.fft.rfftfreq(size, 1/rate)
    power = spectrum ** 2
    energy = np.maximum(power.sum(axis=1), 1e-15)
    band = (frequencies >= 100) & (frequencies <= 3500)
    body = power[:, band].sum(axis=1) / energy
    flatness = np.exp(np.mean(np.log(np.maximum(power[:, band], 1e-15)), axis=1)) / np.maximum(np.mean(power[:, band], axis=1), 1e-15)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    log = np.log1p(spectrum[:, band])
    flux = np.r_[0., np.maximum(np.diff(log, axis=0), 0).mean(axis=1)]
    # Centered frames are indexed at the original sample time; no fake media offset.
    times = np.arange(len(rms))*hop/rate
    return {"time": times, "rms": rms, "body": body, "flatness": flatness, "flux": flux}


def extract_pitch(signal, rate):
    """Reuse unchanged conservative Essentia MELODIA/segmentation defaults."""
    import essentia.standard as es
    audio = es.EqualLoudness(sampleRate=rate)(mono(signal))
    pitch, confidence = es.PredominantPitchMelodia(sampleRate=rate, frameSize=2048, hopSize=128, guessUnvoiced=False)(audio)
    starts, lengths, midi = es.PitchContourSegmentation(sampleRate=rate, hopSize=128)(pitch, audio)
    notes = []
    duration = len(audio)/rate
    for onset, length, note in zip(starts, lengths, midi):
        start, end, note = float(onset), min(duration, float(onset+length)), float(note)
        a, b = round(start*rate/128), min(len(pitch), round(end*rate/128))
        if b <= a or end <= start or not 0 <= note <= 127:
            continue
        if not np.all((pitch[a:b] > 0) & (confidence[a:b] > 0)):
            continue
        strength = float(np.mean(confidence[a:b]))
        # MELODIA confidence is not a calibrated class probability. Preserve
        # its positive voiced segments just as the accepted private baseline.
        if notes and start < notes[-1]["end"]:
            if notes[-1]["end"]-start > 128/rate:
                continue
            notes[-1]["end"] = start
        notes.append({"start": start, "end": end, "pitch": note, "confidence": min(1., strength)})
    return notes


def vocal_attacks(value, drums=None):
    rms, body, flux, flatness = (value[key] for key in ("rms", "body", "flux", "flatness"))
    audible = rms >= POLICY["absoluteRmsFloor"]
    # Vocal-body evidence excludes brief sibilance/breath and white-noise attacks;
    # it does not demand an F0, a MIDI note, language or singing classification.
    voiced_body = audible & (body >= .35) & (flatness <= .35)
    floor = max(float(np.median(flux)+2.5*np.median(np.abs(flux-np.median(flux)))), .001)
    events = []
    sustain = max(1, round(POLICY["minimumBodySeconds"]/POLICY["hopSeconds"]))
    for i in range(1, len(flux)-sustain):
        if flux[i] < floor or flux[i] <= flux[i-1] or flux[i] < flux[i+1]:
            continue
        if np.mean(voiced_body[i:i+sustain]) < .7:
            continue
        if drums is not None:
            # Strong coincident separated-drum novelty is bleed evidence, not a vocal identity.
            d = drums["flux"][max(0,i-2):i+3]
            if len(d) and np.max(d) > flux[i]*2 and drums["rms"][i] > rms[i]*2:
                continue
        start = float(value["time"][i])
        if events and start-events[-1]["start"] < POLICY["vocalSpacing"]:
            continue
        previous = float(np.mean(rms[max(0,i-8):i]))
        following = float(np.mean(rms[i:i+sustain]))
        articulation = float(flux[i]/max(floor, 1e-12))
        if following <= previous*1.05 and articulation < 1.8:
            continue
        confidence = min(.9, .45+.15*min(2., articulation-1.))
        events.append({"start": start, "end": start+.08, "confidence": confidence,
                       "kind": "vocal-articulation", "evidence": "persistent-vocal-body-and-articulation"})
    return events


def select_passages(scores):
    """Offline sequence selection with ambiguity abstention and a switch cost."""
    if not len(scores):
        return []
    # Fifth state is abstention. Its score penalizes forcing an ambiguous source.
    emissions = []
    for row in scores:
        order = sorted(row, reverse=True)
        ambiguous = order[0]-order[1] < POLICY["ambiguityMargin"]
        emissions.append([score-.001 if ambiguous else score for score in row]+[order[0] if ambiguous else POLICY["minimumScore"]])
    emissions = np.asarray(emissions)
    transitions = np.full((5,5), -POLICY["switchPenalty"])
    np.fill_diagonal(transitions, 0.)
    value, parents = emissions[0].copy(), []
    for emission in emissions[1:]:
        proposed = value[:,None]+transitions
        parent = np.argmax(proposed, axis=0)
        value = proposed[parent,np.arange(5)]+emission
        parents.append(parent)
    state = int(np.argmax(value)); owners = [state]
    for parent in reversed(parents):
        state = int(parent[state]); owners.append(state)
    return list(reversed(owners))


def analyze_sources(stems, rate, pitch_extractor=extract_pitch):
    began = time.perf_counter()
    if rate != 44100 or not all(name in stems for name in SOURCES):
        raise ValueError("lead_requires_aligned_melodic_sources")
    signals = {name: mono(stems[name]) for name in SOURCES}
    lengths = {len(value) for value in signals.values()}
    if len(lengths) != 1 or not 0 < next(iter(lengths))/rate <= 70:
        raise ValueError("bounded_aligned_lead_sources_required")
    duration = next(iter(lengths))/rate
    measured = {name: features(signal,rate) for name,signal in signals.items()}
    drums = features(stems["drums"],rate) if "drums" in stems else None
    notes = {name: pitch_extractor(signal,rate) if np.max(measured[name]["rms"]) >= POLICY["absoluteRmsFloor"] else []
             for name,signal in signals.items()}
    vocal = vocal_attacks(measured["vocals"], drums)
    scores, evidence = [], []
    for start in np.arange(0,duration,POLICY["passageSeconds"]):
        end = min(duration,float(start)+POLICY["passageSeconds"])
        energies = [float(np.mean(measured[name]["rms"][(measured[name]["time"]>=start)&(measured[name]["time"]<end)]**2)) for name in SOURCES]
        total = max(sum(energies),1e-15); row = []; detail = {}
        for name,energy in zip(SOURCES,energies):
            f = measured[name]; mask = (f["time"]>=start)&(f["time"]<end)
            activity = float(np.mean(f["rms"][mask]>=POLICY["absoluteRmsFloor"]))
            overlap = sum(max(0.,min(end,n["end"])-max(start,n["start"])) for n in notes[name])/(end-start)
            articulation = min(1.,sum(start<=n["start"]<end for n in vocal)/(end-start)/2) if name=="vocals" else 0.
            body = float(np.mean((f["body"][mask]>=.35)&(f["flatness"][mask]<=.35))) if name=="vocals" else 0.
            support = max(min(1.,overlap),body*.65+articulation*.35) if name=="vocals" else min(1.,overlap)
            score = .4*math.sqrt(energy/total)+.25*activity+.35*support if support>.1 and activity>.1 else 0.
            row.append(score); detail[name] = {"energyShare":energy/total,"activity":activity,"pitchedCoverage":overlap,"vocalBody":body,"articulation":articulation,"score":score}
        scores.append(row); evidence.append({"start":float(start),"end":end,"sources":detail})
    owners = select_passages(scores); events = []; sections = []
    for index,(window,state) in enumerate(zip(evidence,owners)):
        source = SOURCES[state] if state<4 and scores[index][state]>=POLICY["minimumScore"] else None
        sections.append({"start":window["start"],"end":window["end"],"source":source,
                         "reason":"selected-passage-evidence" if source else "ambiguous-or-insufficient"})
        if source is None:
            continue
        proposals = [{**n,"kind":"pitched-note","evidence":"conservative-measured-pitch-contour"} for n in notes[source]]
        if source=="vocals":
            proposals += vocal
        proposals.sort(key=lambda n:(n["start"],-n["confidence"]))
        digest = hashlib.sha256(signals[source].astype("<f4").tobytes()).hexdigest()
        for note in proposals:
            if not window["start"]<=note["start"]<window["end"]:
                continue
            spacing = POLICY["vocalSpacing"] if source=="vocals" else POLICY["noteSpacing"]
            if events and note["start"]-events[-1]["start"]<spacing:
                continue
            if events and events[-1]["end"]>note["start"]:
                events[-1]["end"] = note["start"]
            boundary = window["end"]
            for following in range(index+1,len(owners)):
                if owners[following]!=state or scores[following][state]<POLICY["minimumScore"]:
                    break
                boundary = evidence[following]["end"]
            end = min(note["end"],boundary,duration)
            if end<=note["start"]:
                continue
            events.append({**note,"end":end,"source":source,"inputSha256":digest,"policyVersion":VERSION,
                           "detector":"melodia" if note["kind"]=="pitched-note" else "vocal-body-articulation"})
    return {"version":VERSION,"duration":duration,"events":events,"sections":sections,
            "passageEvidence":evidence,"policy":POLICY,"runtimeSeconds":time.perf_counter()-began,
            "musicalAcceptance":"pending-human-listening","confidenceMeaning":"uncalibrated evidence strength"}
