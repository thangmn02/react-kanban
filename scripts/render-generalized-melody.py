"""One local comparison and candidate/role/retention audit; no accuracy claims."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from importlib import import_module
listen_audio = import_module("prepare-melody-closure").listen_audio


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / "src-tauri/target"):
        raise ValueError("Comparison must remain private")
    cases = json.loads((output / "preparation.json").read_text())["cases"]
    if not 20 <= len(cases) <= 30:
        raise ValueError("Prepare the complete representative set before comparing")
    reports = []
    tracker_hash = hashlib.sha256((ROOT / "server/melodic-role-tracker.ts").read_bytes()
                                  + (ROOT / "server/phrase-melody-tracker.ts").read_bytes()).hexdigest()
    for case in cases:
        path = output / case["id"]
        subprocess.run([os.environ.get("NODE_BINARY", "node"), ROOT / "scripts/select-melodic-role.mjs",
                        path / "candidates.json", path / "candidate.json"], check=True, timeout=30,
                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        baseline = json.loads((path / "baseline.json").read_text())
        candidate = json.loads((path / "candidate.json").read_text())
        raw = json.loads((path / "candidates.json").read_text())
        original, rate = sf.read(str(path / "original.wav"), dtype="float32", always_2d=True)
        listen_audio(original, rate, candidate["notes"], path)
        baseline_dir = path / "baseline-audio"
        baseline_dir.mkdir(exist_ok=True)
        listen_audio(original, rate, baseline["notes"], baseline_dir)
        for source in raw["candidates"]:
            destination = path / f"raw-{source['source']}"
            destination.mkdir(exist_ok=True)
            # Polyphonic raw synthesis is intentionally not a selected main lead.
            listen_audio(original, rate, source["notes"], destination)
        reports.append({**case, "version": candidate["version"], "trackerSha256": tracker_hash, "notes": candidate["notes"],
                        "sections": candidate["sections"], "phrases": candidate["phrases"],
                        "baseline": {"notes": baseline["notes"], **baseline["leadDecision"]},
                        "dispositions": candidate["dispositions"],
                        "candidateAvailability": "human-audition-required",
                        "melodicRole": "human-audition-required", "noteRetention": "human-audition-required",
                        "perceptualAccuracy": None})
    (output / "report.json").write_text(json.dumps({"cases": reports}, indent=2), encoding="utf-8")
    summary = []
    for case in reports:
        summary.append({"id": case["id"], "split": case["split"], "category": case["category"],
                        "raw": {d["source"]: d["rawCount"] for d in case["dispositions"]},
                        "baselineAttacks": len(case["baseline"]["notes"]), "candidateAttacks": len(case["notes"]),
                        "ownedSeconds": {name: round(sum(s["end"]-s["start"] for s in case["sections"] if s.get("source")==name), 3)
                                         for name in ("vocals", "piano", "guitar", "other")},
                        "dispositions": {d["source"]: d["counts"] for d in case["dispositions"]},
                        "candidateAvailability": case["candidateAvailability"], "musicalAcceptance": "pending"})
    (output / "stage-audit.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    template = ROOT / "scripts/generalized-melody-listening.html"
    data = json.dumps(reports).replace("<", "\\u003c")
    (output / "listen.html").write_text(template.read_text(encoding="utf-8").replace("/*CASE_DATA*/[]", data), encoding="utf-8")
    print(json.dumps({"excerpts": len(reports), "families": len({case["family"] for case in reports}),
                      "rubric": "pending-human-listening", "comparison": str(output / "listen.html")}))


if __name__ == "__main__":
    main()
