"""Bounded private Melody evidence. No provider fetch, percussion or publication."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(arguments):
    subprocess.run([str(value) for value in arguments], check=True, timeout=60,
                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def extract_candidates(audio, directory, models):
    import torch
    from demucs.apply import apply_model
    from basic_pitch.inference import predict
    data, rate = sf.read(str(audio), dtype="float32", always_2d=True)
    duration = len(data) / rate
    waveform = torch.from_numpy(data.T.copy())
    reference = waveform.mean(0)
    mean, std = reference.mean(), reference.std()
    if std.item() < 1e-7:
        return {"duration": duration, "candidates": []}
    separator, bp = models
    with torch.no_grad():
        stems = apply_model(separator, ((waveform-mean)/std)[None], device="cpu",
                            shifts=0, split=True, overlap=.25, progress=False)[0]
        stems = (stems*std+mean).numpy()
    result = []
    for index, name in enumerate(separator.sources):
        if name not in ("vocals", "piano", "guitar", "other"):
            continue
        path = directory / f"{name}.wav"
        sf.write(str(path), stems[index].T, rate)
        _, _, notes = predict(path, bp, onset_threshold=.50, frame_threshold=.30, minimum_note_length=100)
        result.append({"source": name, "energy": float(np.mean(stems[index]**2)), "notes": [
            {"start": float(a), "end": min(float(b), duration), "pitch": int(p), "amp": float(amp)}
            for a, b, p, amp, _ in notes if 0 <= a < duration and min(b, duration) > a]})
    return {"duration": duration, "candidates": result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / "src-tauri/target"):
        raise ValueError("Private outputs must remain under ignored target")
    cases_path = Path(args.cases)
    cases = json.loads(cases_path.read_text(encoding="utf-8-sig"))
    if not 20 <= len(cases) <= 30 or len({case['id'] for case in cases}) != len(cases):
        raise ValueError("Expected 20–30 distinct excerpt identities")
    families = {}
    for case in cases:
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", case["id"]) or case["split"] not in ("calibration", "regression", "holdout"):
            raise ValueError("Invalid private excerpt identity or split")
        prior = families.setdefault(case["family"], case["split"])
        if prior != case["split"]:
            raise ValueError("Media family leaks across splits")
    output.mkdir(parents=True, exist_ok=True)
    locked = output / "locked-cases.json"
    if locked.exists() and json.loads(locked.read_text()) != cases:
        raise ValueError("Corpus already locked; use a new output for a changed split")
    locked.write_text(json.dumps(cases, indent=2), encoding="utf-8")
    models = None
    reports = []
    audio_identities = set()
    for case in cases:
        destination = output / case["id"]
        destination.mkdir(exist_ok=True)
        source = Path(case["audio"]).resolve()
        source_hash = digest(source)
        original = destination / "original.wav"
        provenance = destination / "provenance.json"
        expected = {"sourceSha256": source_hash, "start": case.get("start", 0), "seconds": case.get("seconds", 30),
                    "extraction": "htdemucs-6s-basic-pitch-onnx-onset50-frame30-min100"}
        if provenance.exists() and json.loads(provenance.read_text()) != expected:
            raise ValueError("Saved excerpt provenance changed")
        if not original.exists():
            import imageio_ffmpeg
            run([imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-i", source,
                 "-ss", expected["start"], "-t", expected["seconds"], "-ar", "44100", "-ac", "2", original])
        candidates = destination / "candidates.json"
        started = time.monotonic()
        inference = not candidates.exists() and not case.get("savedCandidates")
        if not candidates.exists():
            if case.get("savedCandidates"):
                # Exact bounded original supplied alongside saved predictions.
                saved = Path(case["savedOriginal"])
                a, ar = sf.read(str(saved), dtype="float32", always_2d=True)
                b, br = sf.read(str(original), dtype="float32", always_2d=True)
                if ar != br or a.shape != b.shape or not np.array_equal(a, b):
                    raise ValueError(f"Cached candidates do not match exact original: {case['id']}")
                shutil.copyfile(case["savedCandidates"], candidates)
            else:
                if models is None:
                    import torch
                    import basic_pitch
                    from basic_pitch.inference import Model
                    from demucs.pretrained import get_model
                    torch.set_num_threads(2)
                    models = (get_model("htdemucs_6s").cpu().eval(),
                              Model(Path(basic_pitch.__file__).parent / "saved_models/icassp_2022/nmp.onnx"))
                candidates.write_text(json.dumps(extract_candidates(original, destination, models)))
        value = json.loads(candidates.read_text())
        info = sf.info(str(original))
        if abs(value["duration"] - info.duration) > .02 or not 0 < info.duration <= 40:
            raise ValueError("Candidate duration differs from bounded input")
        decoded, _ = sf.read(str(original), dtype="float32", always_2d=True)
        decoded_hash = hashlib.sha256(decoded.tobytes()).hexdigest()
        if decoded_hash in audio_identities:
            raise ValueError("Duplicate audio must not count as a second listening excerpt")
        audio_identities.add(decoded_hash)
        provenance.write_text(json.dumps(expected), encoding="utf-8")
        run([os.environ.get("NODE_BINARY", "node"), ROOT / "scripts/select-lead-source.mjs",
             candidates, destination / "baseline.json", "--phrases"])
        reports.append({**case, "audioSha256": digest(original), "decodedAudioSha256": decoded_hash, "candidateSha256": digest(candidates),
                        "duration": info.duration, "runtimeSeconds": round(time.monotonic()-started, 3),
                        "runtimeIncludesInference": inference})
        (output / "preparation.json").write_text(json.dumps({"cases": reports}, indent=2))
        print(json.dumps({"id": case["id"], "seconds": reports[-1]["runtimeSeconds"],
                          "raw": {c["source"]: len(c["notes"]) for c in value["candidates"]}}), flush=True)


if __name__ == "__main__":
    main()
