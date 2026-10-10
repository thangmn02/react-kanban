"""Export existing pretrained drum weights; no training or audio input."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import torch
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server/audio-analysis"))
from percussion import LearnedPercussion, WINDOW_FRAMES, STEP_FRAMES, RIGHT_CONTEXT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    destination = Path(args.output)
    destination.mkdir(parents=True, exist_ok=True)
    detector = LearnedPercussion()
    model = destination / "percussion.onnx"
    torch.onnx.export(detector.model, torch.zeros(1, WINDOW_FRAMES, detector.bins, 1), str(model),
                      input_names=["audio"], output_names=["scores"], opset_version=17,
                      do_constant_folding=True)
    session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(724)
    parity = []
    for value in (np.zeros((1, WINDOW_FRAMES, detector.bins, 1), dtype=np.float32),
                  rng.uniform(0, .7, (1, WINDOW_FRAMES, detector.bins, 1)).astype(np.float32)):
        with torch.inference_mode():
            expected = detector.model(torch.from_numpy(value)).numpy()
        actual = session.run(["scores"], {"audio": value})[0]
        error = float(np.max(np.abs(actual-expected)))
        if error > 1e-4:
            raise ValueError(f"export parity failed: {error}")
        parity.append(error)
    filters = []
    for row in detector.processor.filterbank:
        bins = np.flatnonzero(row)
        filters.append({"first": int(bins[0]), "weights": row[bins].tolist()})
    metadata = {"id": "adtof-frame-rnn", "version": 1, "sampleRate": 44100,
                "fftSize": 2048, "hopSize": 441, "fps": 100, "bins": detector.bins,
                "windowFrames": WINDOW_FRAMES, "stepFrames": STEP_FRAMES, "rightContext": RIGHT_CONTEXT,
                "input": "audio", "output": "scores", "thresholds": [.22, .24, .32, .22, .30],
                "classes": ["kick", "snare", "tom", "hat", "cymbal"],
                "abstain": "no accepted learned percussion class",
                "confidenceMeaning": "uncalibrated learned activation and peak margin",
                "sha256": hashlib.sha256(model.read_bytes()).hexdigest(), "bytes": model.stat().st_size,
                "parameters": detector.model.get_model_info()["total_parameters"],
                "onnxParityMaxErrors": parity, "filterbank": filters,
                "weightsSource": "https://github.com/xavriley/ADTOF-pytorch",
                "originalLicense": "CC-BY-NC-SA-4.0", "deployment": "local experiment only"}
    (destination / "percussion.json").write_text(json.dumps(metadata), encoding="utf-8")
    print(json.dumps({key:value for key,value in metadata.items() if key != "filterbank"}), flush=True)


if __name__ == "__main__":
    main()
