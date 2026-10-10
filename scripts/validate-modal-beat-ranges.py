"""Real private-fixture Modal/Supabase validation; never prints credentials."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import threading
import time
import uuid
import modal

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    config = runpy.run_path(str(ROOT / "scripts/configure-modal-beat-analysis.py"))["credentials"]()
    os.environ.update(config)
    sys.path.insert(0, str(ROOT / "server/audio-analysis"))
    analyzer = runpy.run_path(str(ROOT / "server/audio-analysis/range-analysis.py"))
    cache = analyzer["SupabaseCache"]()
    process = subprocess.run([str(ROOT / "node_modules/.bin/supabase.cmd"), "db", "query", "--linked",
                              "select id from auth.users limit 1", "--output", "json"], capture_output=True, text=True, timeout=30)
    if process.returncode:
        raise RuntimeError("Could not resolve authenticated benchmark owner")
    owner = json.loads(process.stdout)["rows"][0]["id"]
    cases = json.loads(Path(args.cases).read_text())[:args.limit]
    volume = modal.Volume.from_name("kora-beat-private-fixtures")
    assets = []
    for case in cases:
        identity = hashlib.sha256(Path(case["audio"]).read_bytes()).hexdigest()[:11]
        key = hashlib.sha256(("youtube:" + identity).encode()).hexdigest()
        assets.append((case, identity, key))
    with volume.batch_upload(force=True) as upload:
        for case, identity, key in assets:
            upload.put_file(case["audio"], "/" + key + ".wav")
    function = modal.Function.from_name("kora-beat-analysis", "analyze_range")
    report = []
    for case, identity, key in assets:
        demand = str(uuid.uuid4())
        parameters = {"p_user": owner, "p_demand": demand, "p_provider": "youtube", "p_asset": identity,
                      "p_version": analyzer["VERSION"], "p_duration": case.get("duration", 30),
                      "p_start": case.get("start", 0), "p_end": case.get("end", 30)}
        claimed = cache.rpc("claim_beat_range", parameters)
        stop = threading.Event()
        def heartbeat():
            while not stop.wait(15):
                try:
                    cache.rpc("claim_beat_range", parameters)
                except Exception:
                    pass
        thread = threading.Thread(target=heartbeat, daemon=True)
        thread.start()
        results = []
        try:
            for job in claimed["jobs"]:
                call = function.spawn(job["jobId"])
                results.append(call.get(timeout=950))
            repeated = cache.rpc("claim_beat_range", parameters)
            if repeated["jobs"]:
                raise RuntimeError("Cache hit dispatched new analysis")
            rows = cache.request(f'/rest/v1/beat_event_chunks?track_id=eq.{claimed["trackId"]}&state=eq.ready&select=chunk_index,event_count,revision,object_path&order=chunk_index')
            counts = {row: 0 for row in ("kick", "snare", "hat", "bass", "melody")}
            holds = []
            for chunk in rows:
                payload = cache.request("/storage/v1/object/authenticated/beat-event-tracks/" + chunk.pop("object_path"))
                for event in payload["events"]:
                    counts[event["type"]] += 1
                    if event["type"] == "bass":
                        holds.append(event["duration"])
            result = {"label": case["label"], "asset": {"provider": "youtube", "id": identity}, "results": results,
                      "readyChunks": rows, "rowCounts": counts, "bassHolds": holds, "cacheHitNewJobs": len(repeated["jobs"])}
            report.append(result)
            Path(args.output).write_text(json.dumps(report, indent=2))
            print(json.dumps({"label": case["label"], "results": results, "readyChunks": len(rows), "cacheHitNewJobs": 0}), flush=True)
            if any(value["status"] != "completed" for value in results):
                raise RuntimeError("Real analyzer gate failed; see bounded status report")
        finally:
            stop.set()
            thread.join(timeout=10)
            cache.request(f"/rest/v1/beat_analysis_demands?id=eq.{demand}", method="DELETE")


if __name__ == "__main__":
    main()
