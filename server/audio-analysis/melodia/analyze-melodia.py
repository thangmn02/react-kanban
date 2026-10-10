"""Private original-mixture MELODIA analysis using the actual Essentia API."""
import argparse
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import re
import time
import wave

import essentia.standard as es
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
VERSION = "essentia-melodia-defaults-v1"
RATE, HOP, FRAME = 44100, 128, 2048


def intervals(mask, duration):
    changes = np.diff(np.r_[False, mask, False].astype(np.int8))
    return [{"start": float(a * HOP / RATE), "end": min(duration, float(b * HOP / RATE))}
            for a, b in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)) if a * HOP / RATE < duration]


def normalize_notes(onsets, durations, midi, pitch, confidence, duration):
    """Keep Essentia's boundaries, excluding invalid/tail frames and true rests."""
    notes, omitted = [], []
    voiced = (pitch > 0) & (confidence > 0)
    if not len(onsets) == len(durations) == len(midi):
        raise ValueError("segmentation_output_shape")
    for index, (onset, length, note) in enumerate(zip(onsets, durations, midi)):
        start, end, note = float(onset), min(duration, float(onset) + float(length)), float(note)
        if not all(math.isfinite(x) for x in (start, end, note)) or start < 0 or not 0 <= note <= 127:
            raise ValueError("invalid_segmentation_output")
        if end <= start or start >= duration:
            omitted.append({"index": index, "reason": "zero-duration-or-padded-tail"}); continue
        a, b = round(start * RATE / HOP), min(len(pitch), round(end * RATE / HOP))
        if a >= b or not np.all(voiced[a:b]):
            # Fail closed rather than interpolate a note through a genuine rest.
            omitted.append({"index": index, "reason": "unvoiced-intersection", "start": start, "end": end}); continue
        mean = float(np.mean(confidence[a:b]))
        if not 0 <= mean <= 1:
            raise ValueError("confidence_outside_event_contract")
        if notes and start < notes[-1]["end"]:
            if notes[-1]["end"] - start > HOP / RATE:
                raise ValueError("overlapping_monophonic_notes")
            notes[-1]["end"] = start  # float32 boundary rounding only
        notes.append({"start": start, "end": end, "pitch": note, "amp": mean,
                      "source": "original-mixture", "rawSegmentIndex": index})
    return notes, omitted


def write_wav(path, samples):
    data = np.asarray(samples, dtype=float)
    if data.ndim == 1:
        data = data[:, None]
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(data.shape[1]); output.setsampwidth(2); output.setframerate(RATE)
        output.writeframes(pcm.tobytes())


def sonify(original, pitch, confidence, notes, output):
    count = len(original)
    hz = np.repeat(np.where((pitch > 0) & (confidence > 0), pitch, 0), HOP)[:count]
    if len(hz) < count:
        hz = np.pad(hz, (0, count-len(hz)))
    voiced = hz > 0
    tone = np.sin(2*np.pi*np.cumsum(hz)/RATE) * .14 * voiced
    # Fade only within voiced islands. No interpolation across missing F0/rests.
    for region in intervals((pitch > 0) & (confidence > 0), count/RATE):
        a, b = round(region["start"]*RATE), round(region["end"]*RATE)
        fade = min(round(.004*RATE), (b-a)//2)
        if fade:
            tone[a:a+fade] *= np.linspace(0, 1, fade)
            tone[b-fade:b] *= np.linspace(1, 0, fade)
    note_tone = np.zeros(count)
    clicks = np.zeros(count)
    click_t = np.arange(round(.025*RATE))/RATE
    click = .1*np.sin(2*np.pi*1600*click_t)*np.hanning(len(click_t))
    for note in notes:
        a, b = round(note["start"]*RATE), min(count, round(note["end"]*RATE))
        t = np.arange(b-a)/RATE
        envelope = np.minimum(1, t/.01)*np.minimum(1, ((b-a)/RATE-t)/.02)
        note_tone[a:b] += .14*np.sin(2*np.pi*440*2**((note["pitch"]-69)/12)*t)*envelope
        size = min(len(click), count-a); clicks[a:a+size] += click[:size]
    write_wav(output/"f0-pitches.wav", tone)
    write_wav(output/"original-f0.wav", np.c_[original*.7, tone])
    write_wav(output/"selected-pitches.wav", note_tone)
    write_wav(output/"primary-clicks.wav", original*.7+clicks)


def analyze(audio_file, output, identity, expected_audio_sha=None, asset=None):
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", identity):
        raise ValueError("invalid_fixture_identity")
    audio_file, output = Path(audio_file).resolve(), Path(output).resolve()
    if not output.is_relative_to(ROOT/"src-tauri/target"):
        raise ValueError("private_output_required")
    if audio_file.suffix.lower() != ".wav" or not audio_file.is_file() or audio_file.stat().st_size > 16*1024*1024:
        raise ValueError("bounded_local_wav_required")
    raw, rate, _, _, _, _ = es.AudioLoader(filename=str(audio_file))()
    duration = len(raw)/rate
    if rate != RATE or not 0 < duration <= 40:
        raise ValueError("bounded_44100_excerpt_required")
    decoded_sha = hashlib.sha256(np.asarray(raw, dtype="<f4").tobytes()).hexdigest()
    input_sha = hashlib.sha256(audio_file.read_bytes()).hexdigest()
    # The listening manifest identifies the exact WAV file, not decoded PCM.
    if expected_audio_sha and expected_audio_sha != input_sha:
        raise ValueError("fixture_audio_identity_mismatch")
    output.mkdir(parents=True, exist_ok=True)
    previous = output/"analysis.json"
    if previous.exists() and json.loads(previous.read_text())["inputFileSha256"] != input_sha:
        raise ValueError("output_belongs_to_different_audio")
    started = time.monotonic()
    eqloud = es.EqloudLoader(filename=str(audio_file), sampleRate=RATE)()
    if len(eqloud) != len(raw):
        raise ValueError("preprocessing_changed_clock")
    extractor = es.PredominantPitchMelodia(sampleRate=RATE, frameSize=FRAME, hopSize=HOP, guessUnvoiced=False)
    pitch, confidence = extractor(eqloud)
    extracted = time.monotonic()
    if len(pitch) != len(confidence) or not np.all(np.isfinite(pitch)) or not np.all(np.isfinite(confidence)):
        raise ValueError("invalid_contour")
    segmenter = es.PitchContourSegmentation(sampleRate=RATE, hopSize=HOP)
    onsets, durations, midi = segmenter(pitch, eqloud)
    notes, omitted = normalize_notes(onsets, durations, midi, pitch, confidence, duration)
    analysis_time = time.monotonic()-started
    # Both algorithms define time zero at the first contour frame, no half-frame shift.
    times = np.arange(len(pitch))*HOP/RATE
    visible = times < duration
    voiced = (pitch > 0) & (confidence > 0) & visible
    rests = intervals(~voiced & visible, duration)
    sections = sorted([{**r, "source": "predominant-mixture"} for r in intervals(voiced, duration)] + rests, key=lambda s:s["start"])
    parameters = {name: extractor.paramValue(name) for name in extractor.parameterNames()}
    segmentation_parameters = {name: segmenter.paramValue(name) for name in segmenter.parameterNames()}
    packages = {name: importlib.metadata.version(name) for name in ("essentia", "numpy", "PyYAML", "six")}
    result = {"id": identity, "version": VERSION, "analyzerVersion": VERSION, "inputSource": "original-mixture",
              "analyzerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "audioSha256": input_sha, "decodedAudioSha256": decoded_sha, "inputFileSha256": input_sha, "duration": duration,
              "packages": packages, "python": platform.python_version(), "platform": platform.platform(),
              "parameters": parameters, "segmentationParameters": segmentation_parameters,
              "notes": notes, "sections": sections, "rests": rests,
              "frames": [{"time": float(t), "hz": float(p), "pitchConfidence": float(c), "voiced": bool(v)}
                         for t,p,c,v in zip(times[visible],pitch[visible],confidence[visible],voiced[visible])],
              "rawSegmentation": [{"start": float(a), "duration": float(d), "pitch": float(p)} for a,d,p in zip(onsets,durations,midi)],
              "omittedSegments": omitted, "frameStepSeconds": HOP/RATE, "timeOrigin": "first frame = input time zero",
              "runtime": {"extractionSeconds": extracted-started, "analysisSeconds": analysis_time},
              "musicalAcceptance": "pending-human-listening", "confidenceMeaning": "mean Essentia pitch confidence, not calibrated note accuracy"}
    revision = hashlib.sha256((input_sha+VERSION+json.dumps(parameters,sort_keys=True)).encode()).hexdigest()[:24]
    # A private fixture namespace satisfies the wire schema, not a provider lookup.
    manifest = {"version":1, "asset": asset or {"provider":"soundcloud","id":f"private-local/{identity}"},
                "revision":revision,"analysisVersion":VERSION,"duration":duration,"chunkSeconds":30,"melodyPolicy":"dominant-monophonic"}
    chunks = []
    for index in range(math.ceil(duration/30)):
        events = []
        for number, note in enumerate(notes):
            if index*30 <= note["start"] < min((index+1)*30,duration):
                events.append({"id": f"melodia:{revision}:{number}", "time":note["start"],"row":"melody",
                               "confidence":note["amp"],"duration":note["end"]-note["start"]})
        if len(events)>4096:
            raise ValueError("too_many_chunk_events")
        chunks.append({"version":1,"revision":revision,"index":index,"events":events})
    (output/"analysis.json").write_text(json.dumps(result,indent=2,allow_nan=False))
    (output/"event-track.json").write_text(json.dumps({"manifest":manifest,"chunks":chunks},indent=2,allow_nan=False))
    np.savez_compressed(output/"contour.npz", pitchHz=pitch, pitchConfidence=confidence, times=times)
    (output/"contour.csv").write_text("time,pitchHz,pitchConfidence,voiced\n"+"".join(f"{t:.9f},{p:.6f},{c:.6f},{int(v)}\n" for t,p,c,v in zip(times,pitch,confidence,voiced)))
    sonify(np.mean(raw,axis=1),pitch,confidence,notes,output)
    summary = {"id":identity,"notes":len(notes),"rawSegments":len(onsets),"omitted":len(omitted),"voicedSeconds":sum(s["end"]-s["start"] for s in sections if s.get("source")),
               "restSeconds":sum(s["end"]-s["start"] for s in rests),"runtimeSeconds":analysis_time,"output":str(output)}
    print(json.dumps(summary),flush=True)
    return result


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--audio",required=True);parser.add_argument("--output",required=True);parser.add_argument("--id",required=True)
    parser.add_argument("--expected-audio-sha");parser.add_argument("--asset-json")
    args=parser.parse_args()
    analyze(args.audio,args.output,args.id,args.expected_audio_sha,json.loads(args.asset_json) if args.asset_json else None)
