"""Read-only waveform/F0/segmentation audit; never generates semantic events."""
import csv
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
import soundfile as sf
from scipy.signal import find_peaks, stft

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "src-tauri/target/generalized-melody/gymnopedie/input-ab"
OUTPUT = ROOT / "src-tauri/target/gymnopedie-missing-attacks"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze():
    previous = json.loads((ROOT / "src-tauri/target/melodia-input-ab/preserved-before.json").read_text())
    for name, expected in previous.items():
        if sha(ROOT / name) != expected:
            raise ValueError("prior_protected_baseline_changed: " + name)
    paths = [ROOT / name for name in previous]
    paths.extend(p for p in BASE.rglob("*") if p.is_file())
    paths.extend([ROOT / "scripts/generalized-melody-listening.html",
                  ROOT / "src-tauri/target/generalized-melody/listen.html",
                  ROOT / "src-tauri/target/generalized-melody/melodia-input-ab-report.json"])
    paths.extend((ROOT / "src/features/music/diagnostics").glob("*"))
    return {str(p.relative_to(ROOT)).replace("\\", "/"): sha(p) for p in paths if p.is_file()}


def spectrum(audio, rate):
    frequencies, times, bins = stft(audio, fs=rate, nperseg=2048, noverlap=1920, boundary="zeros")
    return frequencies, times, np.abs(bins)


def figure(times, signals, analyses, rows):
    # Standalone scientific evidence; does not replace/change the listening UI.
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="790" viewBox="0 0 1300 790">',
             '<rect width="1300" height="790" fill="#111827"/>',
             '<style>text{fill:#e5e7eb;font:14px sans-serif}.label{font-size:17px}</style>',
             '<text x="55" y="30" class="label">Gymnopédie 0–10 s: saved waveform, F0 and unchanged seven events</text>',
             '<text x="55" y="53">Cyan: original mix. Orange: saved piano stem. Gray lines: diagnostic novelty peaks, NOT verified piano notes.</text>']
    x = lambda time: 70 + time*116
    def line(series, top, height, color, maximum):
        points = " ".join(f"{x(t):.2f},{top+height-height*v/maximum:.2f}" for t,v in zip(times,series))
        parts.append(f'<polyline fill="none" stroke="{color}" stroke-width="1.2" points="{points}"/>')
    panels = [(100,150,"30-ms RMS envelope (same absolute amplitude scale)"),
              (310,100,"Positive spectral novelty (each input normalized for display only)"),
              (470,150,"Saved F0 (MIDI 40–85); absent F0 is dark, not silent audio"),
              (680,40,"Preserved normalized segments; exactly seven raw segments survive")]
    for top,height,label in panels:
        parts.append(f'<text x="55" y="{top-14}" class="label">{label}</text>')
        for second in range(11):
            parts.append(f'<path stroke="#374151" d="M{x(second)} {top}v{height}"/>')
        for row in rows:
            parts.append(f'<path stroke="#4b5563" stroke-dasharray="2 4" d="M{x(row["time"])} {top}v{height}"/>')
    maximum = max(max(s["rms"]) for s in signals.values())
    for name,color in [("mix","#77d5e8"),("stem","#ffc58c")]:
        line(signals[name]["rms"],100,150,color,maximum)
        line(signals[name]["flux"],310,100,color,max(signals[name]["flux"]))
        segment = []
        for frame in analyses[name]["frames"]:
            if not frame["voiced"]:
                if segment:
                    parts.append(f'<polyline fill="none" stroke="{color}" points="{" ".join(segment)}"/>')
                    segment = []
                continue
            midi = 69+12*np.log2(frame["hz"]/440)
            segment.append(f'{x(frame["time"]):.2f},{620-(midi-40)/45*150:.2f}')
        if segment:
            parts.append(f'<polyline fill="none" stroke="{color}" points="{" ".join(segment)}"/>')
    for note in analyses["stem"]["notes"]:
        parts.append(f'<rect x="{x(note["start"])}" y="688" width="{(note["end"]-note["start"])*116}" height="20" fill="#ffc58c"/>')
        parts.append(f'<text x="{x(note["start"])}" y="736">{note["start"]:.3f}</text>')
    for second in range(11):
        parts.append(f'<text x="{x(second)-5}" y="768">{second}s</text>')
    parts.append('</svg>')
    graphic = OUTPUT / "waveform-f0-segments.svg"
    graphic.write_text("\n".join(parts), encoding="utf-8")
    ET.parse(graphic)


def main():
    before = freeze()
    OUTPUT.mkdir(exist_ok=True)
    analyses, signals = {}, {}
    for name in ["mix", "stem"]:
        analyses[name] = json.loads((BASE / name / "analysis.json").read_text())
        audio, rate = sf.read(BASE / f"{name}-input.wav", always_2d=True)
        if rate != 44100 or len(audio) != rate*10 or analyses[name]["audioSha256"] != sha(BASE / f"{name}-input.wav"):
            raise ValueError("input_identity_or_clock_mismatch")
        mono = audio.mean(axis=1)
        frequencies,times,mag = spectrum(mono,rate)
        rms = np.sqrt(np.convolve(mono**2,np.ones(1323)/1323,mode="same"))
        indices = np.minimum(len(mono)-1,np.round(times*rate).astype(int))
        flux = np.r_[0,np.maximum(0,np.diff(mag,axis=1)).sum(axis=0)]
        signals[name] = {"audio":mono,"mag":mag,"rms":rms[indices],"flux":flux}
    stem = analyses["stem"]
    with np.load(BASE / "stem/contour.npz", allow_pickle=False) as contour:
        visible = len(stem["frames"])
        if not np.array_equal(contour["pitchHz"][:visible], [f["hz"] for f in stem["frames"]]) or not np.array_equal(
                contour["pitchConfidence"][:visible], [f["pitchConfidence"] for f in stem["frames"]]):
            raise ValueError("raw_contour_and_json_differ")
    track = json.loads((BASE / "stem/event-track.json").read_text())
    events = [event for chunk in track["chunks"] for event in chunk["events"]]
    if [n["start"] for n in stem["notes"]] != [e["time"] for e in events]:
        raise ValueError("event_track_drops_or_retimes_notes")
    if len(stem["rawSegmentation"]) != 7 or len(stem["notes"]) != 7 or stem["omittedSegments"]:
        raise ValueError("accepted_stem_events_changed")
    for note,raw in zip(stem["notes"],stem["rawSegmentation"]):
        if note["start"] != raw["start"] or note["pitch"] != raw["pitch"] or note["end"] != raw["start"]+raw["duration"]:
            raise ValueError("normalization_changed_raw_segments")
    # Fixed exploratory display rule, not musical ground truth or a production gate.
    flux = signals["stem"]["flux"]
    peaks,_ = find_peaks(flux,distance=round(.22/(128/rate)),prominence=float(flux.max())*.035)
    rows = []
    for i in peaks:
        time = float(times[i]); start,end = max(0,time-.06),min(10,time+.18)
        a,b = round(start*rate),round(end*rate)
        frames = [f for f in stem["frames"] if time <= f["time"] <= time+.15]
        near = [n for n in stem["notes"] if abs(n["start"]-time) <= .08]
        holding = [n for n in stem["notes"] if n["start"] < time < n["end"]]
        voiced = sum(f["voiced"] for f in frames)
        row = {"time":time,"semantic":False,"input":"saved-piano-stem",
               "status":"represented" if near else "missing-F0" if not voiced else "voiced-without-nearby-onset",
               "stemFluxRelative":float(flux[i]/flux.max()),"post150msVoicedFrames":voiced,
               "post150msTotalFrames":len(frames),"post150msMaxConfidence":max((f["pitchConfidence"] for f in frames),default=0),
               "nearestSegmentStart":min(stem["notes"],key=lambda n:abs(n["start"]-time))["start"],
               "holdingSegmentStart":holding[0]["start"] if holding else None}
        for name in ["mix","stem"]:
            row[name+"Rms"] = float(np.sqrt(np.mean(signals[name]["audio"][a:b]**2)))
        row["stemMixRmsRatio"] = row["stemRms"]/row["mixRms"]
        mask = (times>=start)&(times<=end)
        for lo,hi in [(80,500),(500,2500),(2500,8000)]:
            band = (frequencies>=lo)&(frequencies<hi)
            values = {name:float((signals[name]["mag"][band][:,mask]**2).sum()) for name in ["mix","stem"]}
            row[f"stemMixEnergyRatio{lo}-{hi}Hz"] = values["stem"]/max(values["mix"],1e-30)
        rows.append(row)
    voiced_regions = [s for s in stem["sections"] if s.get("source")]
    unrepresented = [s for s in voiced_regions if not any(abs(n["start"]-s["start"]) < stem["frameStepSeconds"] for n in stem["notes"])]
    if unrepresented:
        raise ValueError("voiced_island_missing_from_segments")
    result = {"humanFeedback":"Approximately 12 audible attacks; seven stem events mostly correctly timed, incomplete. Mixture flashes incorrect. Qualitative only.",
              "candidateMethod":{"semantic":False,"window":2048,"hop":128,"minimumPeakSpacingSeconds":.22,"prominenceRelativeToPeak":.035,
                                 "warning":"Exploratory novelty peaks include decay, chords and accompaniment; they are not twelve reference attacks."},
              "rawSegments":stem["rawSegmentation"],"normalizedNotes":stem["notes"],"omittedSegments":stem["omittedSegments"],
              "voicedRegions":voiced_regions,"voicedRegionsWithoutSegment":unrepresented,"rests":stem["rests"],
              "rawContourMatchesJson":True,"eventTrackPreservesOnsets":True,
              "observations":rows,"protectedFiles":len(before),"algorithmOrGridChanged":False}
    (OUTPUT / "audit.json").write_text(json.dumps(result,indent=2))
    with (OUTPUT / "waveform-candidates.csv").open("w",newline="") as output:
        writer=csv.DictWriter(output,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    figure(times,signals,analyses,rows)
    after = freeze()
    if before != after:
        raise ValueError("protected_inputs_or_grid_changed")
    (OUTPUT / "preservation.json").write_text(json.dumps({"before":before,"after":after,"unchanged":True},indent=2))
    print(json.dumps({"protectedFiles":len(before),"rawSegments":len(stem["rawSegmentation"]),"normalizedEvents":len(stem["notes"]),
                      "voicedRegions":len(voiced_regions),"omitted":len(stem["omittedSegments"]),"diagnosticCandidates":len(rows),
                      "missingF0Examples":[r for r in rows if r["status"]=="missing-F0" and r["stemFluxRelative"]>.35]},indent=2))


if __name__ == "__main__":
    main()
