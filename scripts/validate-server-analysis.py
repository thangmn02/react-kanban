"""Run private audio holdouts through real async admission/inference/cache HTTP."""
import hashlib
import json
import math
import os
from pathlib import Path
import secrets
import shutil
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / "server/audio-analysis"))
from service import AnalysisService, handler_for


def validate(cases, report):
    if not isinstance(cases, list) or not 1 <= len(cases) <= 30:
        raise ValueError("Expected 1-30 private holdout cases")
    results = []
    previous = os.environ.get("BEAT_MEDIA_DIRECTORY")
    with tempfile.TemporaryDirectory(prefix="kora-server-validation-") as temporary:
        directory = Path(temporary)
        media = directory / "media"
        media.mkdir()
        os.environ["BEAT_MEDIA_DIRECTORY"] = str(media)
        token = secrets.token_urlsafe(32)
        service = AnalysisService(directory / "state", token)
        http = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(service))
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        service.start()
        url = f"http://127.0.0.1:{http.server_port}"
        try:
            for index, case in enumerate(cases):
                # Fixture identity is confined to the private validation cache;
                # no synthetic provider identity is published to production.
                identity = hashlib.sha256(str(index).encode()).hexdigest()[:11]
                key = hashlib.sha256(f"1:youtube:{identity}".encode()).hexdigest()
                shutil.copyfile(Path(case["audio"]), media / f"{key}.wav")
                value = {"version": 1, "asset": {"provider": "youtube", "id": identity}, "cacheKey": key,
                         "chunkSeconds": 30, "melodyPolicy": "dominant-monophonic"}
                started = time.monotonic()
                request = urllib.request.Request(url + "/analyze", data=json.dumps(value).encode(), headers={
                    "Authorization": f"Bearer {token}", "Idempotency-Key": key, "Content-Type": "application/json"})
                with urllib.request.urlopen(request, timeout=3) as response:
                    assert response.status == 202
                admission = time.monotonic() - started
                assert admission < 1
                while service.records[key]["state"] not in ("complete", "failed"):
                    time.sleep(.1)
                result = {"case": case["label"], "state": service.records[key]["state"],
                          "admissionMs": round(admission * 1000), "elapsedSeconds": round(time.monotonic() - started, 2)}
                if result["state"] == "complete":
                    with urllib.request.urlopen(url + f"/cache/{key}/manifest.json", timeout=3) as response:
                        manifest = json.load(response)
                    events = []
                    for chunk in range(math.ceil(manifest["duration"] / 30)):
                        with urllib.request.urlopen(url + f"/cache/{key}/{chunk}.json", timeout=3) as response:
                            events.extend(json.load(response)["events"])
                    notes = [event for event in events if event["row"] == "melody"]
                    assert all(a["time"] + a.get("duration", 0) <= b["time"] + 1e-6 for a, b in zip(notes, notes[1:]))
                    result.update(duration=manifest["duration"], monophonic=True, cacheHit=True,
                                  rows={row: sum(event["row"] == row for event in events)
                                        for row in ("kick", "snare", "hat", "bass", "melody")})
                    for line in (service.jobs / f"{key}.log").read_text(encoding="utf-8").splitlines():
                        if line.startswith('{"stage":"lead-selected"'):
                            result["lead"] = json.loads(line)
                    assert service.submit(value, key)[1]["status"] == "complete"
                results.append(result)
                report.write_text(json.dumps(results, indent=2), encoding="utf-8")
                print(json.dumps(result), flush=True)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()
            service.close()
            if previous is None:
                os.environ.pop("BEAT_MEDIA_DIRECTORY", None)
            else:
                os.environ["BEAT_MEDIA_DIRECTORY"] = previous
    if any(result["state"] != "complete" for result in results):
        raise RuntimeError("One or more real inference holdouts failed; see report")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/validate-server-analysis.py <private-cases.json> <report.json>")
    validate(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), Path(sys.argv[2]))
