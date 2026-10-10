"""Existing aligned stems -> shared Lead policy. No provider fetch or manual owner."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument("--stems",required=True);parser.add_argument("--output",required=True)
args=parser.parse_args()
source=Path(args.stems);output=Path(args.output).resolve()
if not output.is_relative_to(ROOT/"src-tauri/target"):
    raise ValueError("private_output_required")
spec=importlib.util.spec_from_file_location("lead_pulse",ROOT/"server/audio-analysis/lead-pulse.py")
lead=importlib.util.module_from_spec(spec);spec.loader.exec_module(lead)
with np.load(source,allow_pickle=False) as archive:
    rate=int(archive["rate"]);offset=float(archive["offset"])
    stems={name:archive[name] for name in (*lead.SOURCES,"drums") if name in archive}
result=lead.analyze_sources(stems,rate)
result.update(stemArchiveSha256=hashlib.sha256(source.read_bytes()).hexdigest(),offset=offset,
              policySha256=hashlib.sha256((ROOT/"server/audio-analysis/lead-pulse.py").read_bytes()).hexdigest())
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,allow_nan=False,indent=2))
print(json.dumps({"events":len(result["events"]),"seconds":result["runtimeSeconds"]}),flush=True)
