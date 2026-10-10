"""Bounded streaming-context comparison; model references are not human labels."""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/audio-analysis"))
sys.path.insert(0, str(ROOT / "scripts"))
from percussion import LearnedPercussion, percussion_events
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location("controls", ROOT / "scripts/evaluate-learned-percussion.py")
controls = module_from_spec(spec)
spec.loader.exec_module(controls)


def streaming(model, features, step, right_context):
    length = len(features)
    result = np.zeros((length, 5), dtype=np.float32)
    elapsed = []
    for end in range(step, length + right_context + step, step):
        first = end - 100
        block = np.zeros((100, model.bins, 1), dtype=np.float32)
        a, b = max(0, first), min(length, end)
        if b > a:
            block[a-first:b-first] = features[a:b]
        began = time.perf_counter()
        scores = model.session.run(["scores"], {"audio": block[None]})[0][0]
        elapsed.append((time.perf_counter()-began)*1000)
        start, stop = end-right_context-step, end-right_context
        a, b = max(0, start), min(length, stop)
        if b > a:
            offset = 100-right_context-step+a-start
            result[a:b] = scores[offset:offset+b-a]
    return result, elapsed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--profiles", default="2:4,2:2")
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--audio-manifest")
    args = parser.parse_args()
    target = Path(args.output)
    target.mkdir(parents=True, exist_ok=True)
    if args.audio_manifest:
        manifest = Path(args.audio_manifest)
        cases = [{"track": entry["input"], "role": entry["role"], "duration": entry["duration"],
                  "files": [str(manifest.parent / entry["file"])]}
                 for entry in json.loads(manifest.read_text())]
    else:
        cases = json.loads((ROOT / "src-tauri/target/learned-percussion/inputs.json").read_text(encoding="utf-8-sig"))
    model = LearnedPercussion(onnx_path=ROOT / "src-tauri/target/learned-percussion/model/percussion.onnx", threads=1)
    profiles = [tuple(map(int, p.split(":"))) for p in args.profiles.split(",")]
    results = []
    for case in cases:
        if args.only and case["track"] not in args.only:
            continue
        mono = controls.audio(case)
        features = model.features(mono)
        for step, context in profiles:
            scores, runtimes = streaming(model, features, step, context)
            events = percussion_events(scores, len(mono)/44100)
            record = {"input": case["track"], "role": case.get("role", "corpus"), "duration": len(mono)/44100,
                      "stepFrames": step, "rightContext": context, "events": events,
                      "counts": {row: sum(e["type"] == row for e in events) for row in ("kick", "snare", "hat")},
                      "runtimeMedianMs": float(np.median(runtimes)), "runtimeP95Ms": float(np.percentile(runtimes, 95))}
            results.append(record)
            np.save(target / f'{case["track"]}-{step}-{context}-scores.npy', scores)
            (target / "results.json").write_text(json.dumps(results), encoding="utf-8")
            print(json.dumps({k:v for k,v in record.items() if k != "events"}), flush=True)


if __name__ == "__main__":
    main()
