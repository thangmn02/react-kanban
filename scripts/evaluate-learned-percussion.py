"""Private exact-control evaluation; never fetches or uploads media."""
import argparse
import json
from pathlib import Path
import sys
import time

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/audio-analysis"))
from percussion import LearnedPercussion, percussion_events, frame_decisions


def audio(case):
    arrays = []
    for filename in case["files"]:
        info = sf.info(filename)
        start = round(case.get("start", 0) * info.samplerate)
        data, rate = sf.read(filename, start=start, frames=round(case["duration"] * info.samplerate),
                             dtype="float32", always_2d=True)
        mono = data.mean(axis=1)
        if rate != 44100:
            import math
            factor = math.gcd(rate, 44100)
            mono = resample_poly(mono, 44100 // factor, rate // factor).astype(np.float32)
        arrays.append(mono)
    length = min(map(len, arrays))
    return sum(array[:length] for array in arrays)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--onnx")
    args = parser.parse_args()
    cases = json.loads(Path(args.inputs).read_text(encoding="utf-8-sig"))
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    model = LearnedPercussion(onnx_path=args.onnx)
    results = []
    for case in cases:
        if args.only and case["track"] not in args.only:
            continue
        began = time.perf_counter()
        mono = audio(case)
        features = model.features(mono)
        prepared = time.perf_counter()
        activations = model.activations(features)
        events = percussion_events(activations, len(mono) / 44100)
        record = {"input": case["track"], "role": case.get("role", "corpus"), "duration": len(mono)/44100,
                  "events": events, "decisions": frame_decisions(activations, events),
                  "counts": {row: sum(e["type"] == row for e in events) for row in ("kick", "snare", "hat")},
                  "preprocessingSeconds": prepared-began, "inferenceSeconds": time.perf_counter()-prepared,
                  "audioUploaded": False, "sourceSeparation": False}
        results.append(record)
        (output / "results.json").write_text(json.dumps(results), encoding="utf-8")
        np.save(output / (case["track"] + "-activations.npy"), activations)
        print(json.dumps({key: value for key, value in record.items() if key not in ("events", "decisions")}), flush=True)


if __name__ == "__main__":
    main()
