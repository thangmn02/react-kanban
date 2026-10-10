"""Private five-excerpt comparison; original-mixture Essentia, no publication."""
import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src-tauri/target/generalized-melody"
sys.path.insert(0, str(ROOT / "scripts"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(args, timeout=180):
    subprocess.run([str(a) for a in args], check=True, timeout=timeout,
                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def holdout(source):
    """Generate unchanged legacy comparisons once, independently of MELODIA."""
    import numpy as np
    import soundfile as sf
    import imageio_ffmpeg
    directory = OUTPUT / "nhung_loi_hua"
    directory.mkdir(exist_ok=True)
    provenance = {"sourceSha256": digest(source), "start": 30, "seconds": 30}
    saved = directory / "provenance.json"
    if saved.exists() and json.loads(saved.read_text()) != provenance:
        raise ValueError("holdout_input_changed")
    original = directory / "original.wav"
    if not original.exists():
        run([imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-i", source,
             "-ss", "30", "-t", "30", "-ar", "44100", "-ac", "2", original])
    saved.write_text(json.dumps(provenance))
    data, rate = sf.read(original, dtype="float32", always_2d=True)
    candidates = directory / "candidates.json"
    if not candidates.exists():
        os.environ["TORCH_HOME"] = str(ROOT / "src-tauri/target/analysis-models")
        import torch
        import basic_pitch
        from basic_pitch.inference import Model
        from demucs.pretrained import get_model
        torch.set_num_threads(2)
        models = (get_model("htdemucs_6s").cpu().eval(),
                  Model(Path(basic_pitch.__file__).parent / "saved_models/icassp_2022/nmp.onnx"))
        value = importlib.import_module("prepare-generalized-melody").extract_candidates(original, directory, models)
        candidates.write_text(json.dumps(value))
    if not (directory / "baseline.json").exists():
        run(["node", ROOT / "scripts/select-lead-source.mjs", candidates, directory / "baseline.json", "--phrases"])
    if not (directory / "candidate.json").exists():
        run(["node", ROOT / "scripts/select-melodic-role.mjs", candidates, directory / "candidate.json"])
    baseline = json.loads((directory / "baseline.json").read_text())
    candidate = json.loads((directory / "candidate.json").read_text())
    audition = importlib.import_module("prepare-melody-closure").listen_audio
    audition(data, rate, candidate["notes"], directory)
    baseline_dir = directory / "baseline-audio"
    baseline_dir.mkdir(exist_ok=True)
    audition(data, rate, baseline["notes"], baseline_dir)
    for stem in json.loads(candidates.read_text())["candidates"]:
        stem_dir = directory / f"raw-{stem['source']}"
        stem_dir.mkdir(exist_ok=True)
        audition(data, rate, stem["notes"], stem_dir)
    return {"id": "nhung_loi_hua", "family": "nhung_loi_hua", "label": "Những Lời Hứa Bỏ Quên · 0:30–1:00",
            "split": "holdout", "category": "Previously unused Melody holdout; supplied original mix",
            "duration": len(data)/rate, "audioSha256": digest(original), "decodedAudioSha256": hashlib.sha256(data.tobytes()).hexdigest(),
            "candidateSha256": digest(candidates), "trackerSha256": digest(ROOT / "server/melodic-role-tracker.ts"),
            **candidate, "baseline": {"notes": baseline["notes"], **baseline["leadDecision"]}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--holdout", help="Authorized supplied local audio for a previously unused excerpt")
    args = parser.parse_args()
    original_report = json.loads((OUTPUT / "report.json").read_text(encoding="utf-8"))
    cases = original_report["cases"]
    if args.holdout and not any(c["id"] == "nhung_loi_hua" for c in cases):
        cases.append(holdout(Path(args.holdout)))
    chosen = ["lee_hi_hskt", "gymnopedie", "nujabes", "levels", "nhung_loi_hua"]
    if any(not any(c["id"] == identity for c in cases) for identity in chosen):
        raise ValueError("five_required_inputs_missing")
    def linux(path):
        resolved = str(Path(path).resolve()).replace("\\", "/")
        return "/mnt/" + resolved[0].lower() + resolved[2:]
    runtime = ROOT / "src-tauri/target/melodia-venv/bin/python"
    for identity in chosen:
        case = next(c for c in cases if c["id"] == identity)
        directory = OUTPUT / identity
        analysis = directory / "melodia/analysis.json"
        analyzer = ROOT / "server/audio-analysis/melodia/analyze-melodia.py"
        if not analysis.exists() or json.loads(analysis.read_text()).get("analyzerSha256") != digest(analyzer):
            run(["wsl", "-d", "Ubuntu", "--exec", linux(runtime),
                 linux(analyzer),
                 "--audio", linux(directory / "original.wav"), "--output", linux(directory / "melodia"),
                 "--id", identity, "--expected-audio-sha", case["audioSha256"]])
        value = json.loads(analysis.read_text())
        if value["audioSha256"] != case["audioSha256"] or value["decodedAudioSha256"] != case["decodedAudioSha256"]:
            raise ValueError("analyzed_audio_differs_from_fixture")
        case["melodia"] = value
        print(json.dumps({"id": identity, "notes": len(value["notes"]), "rests": len(value["rests"]),
                          "runtime": value["runtime"]}), flush=True)
    # Keep the old report/checkpoints intact. This sidecar alone adds the new stream.
    (OUTPUT / "melodia-report.json").write_text(json.dumps({"cases": cases, "selected": chosen}, indent=2), encoding="utf-8")
    template = (ROOT / "scripts/generalized-melody-listening.html").read_text(encoding="utf-8")
    (OUTPUT / "listen.html").write_text(template.replace("/*CASE_DATA*/[]", json.dumps(cases).replace("<", "\\u003c")), encoding="utf-8")


if __name__ == "__main__":
    main()
