"""Run the bounded Lead policy in its isolated Essentia Python runtime."""
import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np


def run(stems_path, output_path):
    spec = importlib.util.spec_from_file_location(
        "lead_pulse", Path(__file__).with_name("lead-pulse.py"))
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    with np.load(stems_path, allow_pickle=False) as archive:
        rate = int(archive["rate"])
        stems = {name: archive[name] for name in (*policy.SOURCES, "drums") if name in archive}
    result = policy.analyze_sources(stems, rate)
    Path(output_path).write_text(json.dumps(result, allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stems", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.stems, args.output)
