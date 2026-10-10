"""Two fixed diagnostic input pairs; reuse saved stems and unchanged MELODIA."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import correlate, correlation_lags

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "src-tauri/target/generalized-melody"
OUTPUT = ROOT / "src-tauri/target/melodia-input-ab"
# Manual listening examples, never a production source-selection rule.
PASSAGES = [("lee_hi_hskt", "vocals", 16, 26), ("gymnopedie", "piano", 0, 10)]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def baseline_files(cases):
    paths = [ROOT / "server/audio-analysis/melodia/analyze-melodia.py",
             ROOT / "server/phrase-melody-tracker.ts", PAGE / "melodia-report.json"]
    for case in cases:
        folder = PAGE / case["id"]
        for name in ("baseline.json", "candidate.json", "candidates.json", "original.wav"):
            paths.append(folder / name)
        if case.get("melodia"):
            paths.extend(p for p in (folder / "melodia").iterdir() if p.is_file() and not p.name.startswith("browser-"))
    frozen = json.loads((ROOT / "src-tauri/target/melody-closure/baseline-freeze.json").read_text())
    paths.extend(ROOT / p for p in frozen["sourceSha256"])
    return {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p) for p in paths}


def linux(path):
    value = str(Path(path).resolve()).replace("\\", "/")
    return "/mnt/" + value[0].lower() + value[2:]


def alignment(case, stem, start, end):
    original, rate = sf.read(PAGE / case["id"] / "original.wav", dtype="float32", always_2d=True)
    saved = Path(case["savedOriginal"])
    reference, saved_rate = sf.read(saved, dtype="float32", always_2d=True)
    packed_file = saved.parent / "stems-0.0.npz"
    with np.load(packed_file, allow_pickle=False) as packed:
        separated = packed[stem].copy()
        offset, stem_rate, core = float(packed["offset"]), int(packed["rate"]), packed["core"].tolist()
    old = json.loads((saved.parent / "analysis.json").read_text())
    decoded_hash = hashlib.sha256(original.tobytes()).hexdigest()
    if rate != 44100 or saved_rate != rate or stem_rate != rate or offset != 0 or core != [0, 30]:
        raise ValueError("saved_stem_clock_mismatch")
    if not np.array_equal(original, reference) or original.shape != separated.shape or old["audioHash"] != decoded_hash:
        raise ValueError("saved_stem_input_identity_mismatch")
    a, b = round(start*rate), round(end*rate)
    if not 8 <= end-start <= 12 or b > len(original):
        raise ValueError("bounded_passage_required")
    x = original[a:b].mean(axis=1).astype(float)
    y = separated[a:b].mean(axis=1).astype(float)
    x -= x.mean(); y -= y.mean()
    correlations = correlate(x, y, mode="full", method="fft")
    lags = correlation_lags(len(x), len(y))
    window = np.abs(lags) <= round(rate*.1)
    measured_lag = int(lags[window][np.argmax(correlations[window])])
    correlation = float(np.dot(x,y)/np.sqrt(np.dot(x,x)*np.dot(y,y)))
    if abs(measured_lag) > round(rate*.003):
        raise ValueError("unexpected_stem_alignment_requires_review")
    return original, separated, {"originalFileSha256": case["audioSha256"], "decodedAudioSha256": decoded_hash,
        "savedOriginalSha256": digest(saved), "stemArchiveSha256": digest(packed_file),
        "sampleRate": rate, "originalFrames": len(original), "stemFrames": len(separated),
        "reportedOffsetSeconds": offset, "core": core, "cropStartSample": a, "cropEndSample": b,
        "correlationLagSamples": measured_lag, "zeroLagCorrelation": correlation,
        "offsetCorrectionApplied": 0, "manualStem": stem}


def stats(value):
    frames = value["frames"]
    # Descriptive octave-sized discontinuities, not scored pitch mistakes.
    jumps = [{"time": right["time"], "semitones": float(12*np.log2(right["hz"]/left["hz"]))}
             for left,right in zip(frames,frames[1:]) if left["voiced"] and right["voiced"]
             and abs(12*np.log2(right["hz"]/left["hz"])) >= 11]
    return {"notes": len(value["notes"]), "voicedSeconds": value["duration"]-sum(r["end"]-r["start"] for r in value["rests"]),
            "rests": len(value["rests"]), "adjacentOctaveSizedJumps": jumps, "runtime": value["runtime"]}


def main():
    cases = json.loads((PAGE / "melodia-report.json").read_text(encoding="utf-8"))["cases"]
    OUTPUT.mkdir(exist_ok=True)
    freeze = OUTPUT / "preserved-before.json"
    before = baseline_files(cases)
    if freeze.exists() and json.loads(freeze.read_text()) != before:
        raise ValueError("baseline_changed_since_input_experiment")
    freeze.write_text(json.dumps(before, indent=2))
    runtime = ROOT / "src-tauri/target/melodia-venv/bin/python"
    analyzer = ROOT / "server/audio-analysis/melodia/analyze-melodia.py"
    results = []
    for identity, stem, start, end in PASSAGES:
        case = next(c for c in cases if c["id"] == identity)
        original, separated, verified = alignment(case, stem, start, end)
        rate = verified["sampleRate"]
        folder = PAGE / identity / "input-ab"
        folder.mkdir(exist_ok=True)
        a, b = verified["cropStartSample"], verified["cropEndSample"]
        pair = {}
        for name, signal in (("mix", original), ("stem", separated)):
            wav = folder / f"{name}-input.wav"
            if not wav.exists():
                sf.write(wav, signal[a:b], rate, subtype="FLOAT")
            decoded, read_rate = sf.read(wav, dtype="float32", always_2d=True)
            if read_rate != rate or not np.array_equal(decoded, signal[a:b]):
                raise ValueError("cropped_samples_changed")
            target = folder / name
            saved = target / "analysis.json"
            if not saved.exists():
                subprocess.run(["wsl", "-d", "Ubuntu", "--exec", linux(runtime), linux(analyzer),
                                "--audio", linux(wav), "--output", linux(target), "--id", identity+"-"+name,
                                "--expected-audio-sha", digest(wav)], check=True, timeout=60,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            value = json.loads(saved.read_text())
            if value["audioSha256"] != digest(wav) or value["analyzerSha256"] != digest(analyzer):
                raise ValueError("analysis_input_or_algorithm_changed")
            diagnostic_source = "diagnostic-full-mixture" if name == "mix" else f"diagnostic-manual-{stem}"
            # Only the sidecar is offset into the unchanged 30-second original clock.
            shifted = {**value, "version": value["version"]+":input-ab:"+name,
                       "playbackOffset": start, "analysisAudioSha256": value["audioSha256"],
                       "diagnosticInput": diagnostic_source,
                       "notes": [{**n, "start": n["start"]+start, "end": n["end"]+start, "source": diagnostic_source,
                                  "analysisAudioSha256": value["audioSha256"]} for n in value["notes"]],
                       "frames": [{**f, "time": f["time"]+start} for f in value["frames"]],
                       "sections": [{**s, "start": s["start"]+start, "end": s["end"]+start,
                                     **({"source": diagnostic_source} if s.get("source") else {})} for s in value["sections"]],
                       "rests": [{"start": s["start"]+start, "end": s["end"]+start} for s in value["rests"]]}
            shifted["diagnostics"] = stats(value)
            shifted["diagnostics"]["adjacentOctaveSizedJumps"] = [{**j,"time":j["time"]+start} for j in shifted["diagnostics"]["adjacentOctaveSizedJumps"]]
            pair[name] = shifted
            f0, audition_rate = sf.read(target / "f0-pitches.wav", dtype="float32")
            if audition_rate != rate or len(f0) != b-a:
                raise ValueError("f0_audition_clock_mismatch")
            padded = np.zeros(len(original), dtype="float32"); padded[a:b] = f0
            sf.write(folder / f"{name}-f0.wav", padded, rate, subtype="PCM_16")
            sf.write(folder / f"{name}-original-f0.wav", np.c_[original.mean(axis=1)*.7, padded], rate, subtype="PCM_16")
        stem_audio = np.zeros_like(original); stem_audio[a:b] = separated[a:b]
        sf.write(folder / "stem-audio.wav", stem_audio, rate, subtype="PCM_16")
        if pair["mix"]["parameters"] != pair["stem"]["parameters"] or pair["mix"]["segmentationParameters"] != pair["stem"]["segmentationParameters"]:
            raise ValueError("ab_parameters_differ")
        case["inputAb"] = {"start": start, "end": end, "manualStem": stem, "alignment": verified, **pair,
                           "interpretation": "pending-human-listening; manual stem is diagnostic only"}
        results.append({"id":identity,"start":start,"end":end,"stem":stem,"alignment":verified,
                        "mix":pair["mix"]["diagnostics"],"stemResult":pair["stem"]["diagnostics"]})
        print(json.dumps(results[-1]), flush=True)
    after = baseline_files(cases)
    if before != after:
        raise ValueError("protected_baseline_modified")
    (OUTPUT / "report.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (OUTPUT / "preserved-after.json").write_text(json.dumps(after, indent=2))
    (PAGE / "melodia-input-ab-report.json").write_text(json.dumps({"cases":cases,"passages":results}, indent=2), encoding="utf-8")
    template = (ROOT / "scripts/generalized-melody-listening.html").read_text(encoding="utf-8")
    (PAGE / "listen.html").write_text(template.replace("/*CASE_DATA*/[]", json.dumps(cases).replace("<","\\u003c")), encoding="utf-8")


if __name__ == "__main__":
    main()
