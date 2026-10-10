"""Admission, restart and public-cache contracts without model inference."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from service import AnalysisService, handler_for, parse_job, save_json


def job(identity="abcdefghijk"):
    asset = {"provider": "youtube", "id": identity}
    key = hashlib.sha256(f"1:youtube:{identity}".encode()).hexdigest()
    return {"version": 1, "asset": asset, "cacheKey": key,
            "chunkSeconds": 30, "melodyPolicy": "dominant-monophonic"}


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="kora-service-test-")
        self.root = Path(self.temporary.name)
        self.token = "local-test-service-token-12345678"
        self.service = AnalysisService(self.root / "state", self.token, pending_limit=1)
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(self.service))
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.http.server_port}"

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.service.close()
        self.temporary.cleanup()

    def request(self, path, body=None, token=None, key=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if key:
            headers["Idempotency-Key"] = key
        request = urllib.request.Request(self.url + path, data=json.dumps(body).encode() if body is not None else None,
                                         headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=3)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def test_authenticated_bounded_idempotent_admission(self):
        value = job()
        self.assertEqual(self.request("/analyze", value)[0], 401)
        self.assertEqual(self.request("/analyze", value, self.token, "wrong")[0], 400)
        started = time.monotonic()
        self.assertEqual(self.request("/analyze", value, self.token, value["cacheKey"])[0], 202)
        self.assertLess(time.monotonic() - started, .5)
        self.assertEqual(self.request("/analyze", value, self.token, value["cacheKey"])[1]["status"], "queued")
        self.assertEqual(len(self.service.records), 1)
        other = job("bcdefghijkl")
        self.assertEqual(self.request("/analyze", other, self.token, other["cacheKey"])[0], 503)
        self.assertEqual(self.request(f'/cache/{value["cacheKey"]}/manifest.json')[0], 404)
        self.assertEqual(self.request("/cache/../jobs/anything.json")[0], 404)
        self.assertEqual(self.request("/analyze", {"extra": "x" * 3000}, self.token)[0], 413)

    def test_restart_requeues_running_work_and_preserves_idempotency(self):
        value = job()
        self.service.submit(value, value["cacheKey"])
        record = self.service.records[value["cacheKey"]]
        record["state"] = "running"
        save_json(self.service.jobs / f'{value["cacheKey"]}.json', record)
        resumed = AnalysisService(self.service.root, self.token, pending_limit=1)
        try:
            self.assertEqual(resumed.records[value["cacheKey"]]["state"], "queued")
            self.assertEqual(resumed.submit(value, value["cacheKey"])[0], 202)
            self.assertEqual(len(resumed.records), 1)
        finally:
            resumed.close()

    def test_failed_processing_keeps_a_cache_miss_and_bounded_retry(self):
        self.service.processor = [sys.executable, "-c", "raise SystemExit(1)"]
        self.service.start()
        value = job()
        self.service.submit(value, value["cacheKey"])
        deadline = time.monotonic() + 5
        while self.service.records[value["cacheKey"]]["state"] != "failed" and time.monotonic() < deadline:
            time.sleep(.02)
        self.assertEqual(self.service.records[value["cacheKey"]]["state"], "failed")
        self.assertEqual(self.request(f'/cache/{value["cacheKey"]}/manifest.json')[0], 404)
        self.assertEqual(self.service.submit(value, value["cacheKey"])[0], 429)

    def test_completed_worker_output_becomes_public_cache_without_reprocessing(self):
        # Exercise a real child, filesystem output and HTTP cache visibility.
        # This is an interface fixture, not a substitute for model validation.
        script = self.root / "processor.py"
        script.write_text('''import json,sys,time
from pathlib import Path
time.sleep(.1)
record=json.loads(Path(sys.argv[1]).read_text())
key=record["job"]["cacheKey"]
directory=Path(sys.argv[2])/key
directory.mkdir()
(directory/"0.json").write_text(json.dumps({"version":1,"revision":"test","index":0,"events":[]}))
(directory/"manifest.json").write_text(json.dumps({"version":1,"asset":record["job"]["asset"],"revision":"test","analysisVersion":"interface-test","duration":30,"chunkSeconds":30,"melodyPolicy":"dominant-monophonic"}))
''', encoding="utf-8")
        self.service.processor = [sys.executable, str(script)]
        self.service.start()
        value = job()
        self.service.submit(value, value["cacheKey"])
        deadline = time.monotonic() + 5
        while self.service.records[value["cacheKey"]]["state"] != "complete" and time.monotonic() < deadline:
            time.sleep(.02)
        self.assertEqual(self.service.records[value["cacheKey"]]["state"], "complete")
        self.assertEqual(self.request(f'/cache/{value["cacheKey"]}/manifest.json')[0], 200)
        self.assertEqual(self.request(f'/cache/{value["cacheKey"]}/0.json')[0], 200)
        self.assertEqual(self.service.submit(value, value["cacheKey"])[1]["status"], "complete")

    def test_asset_validation_rejects_arbitrary_urls_and_identity_mismatches(self):
        value = job()
        for changed in ({**value, "cacheKey": "0" * 64}, {**value, "chunkSeconds": 60},
                        {**value, "asset": {"provider": "youtube", "id": "https://localhost/private"}}):
            with self.assertRaises(ValueError):
                parse_job(changed)
        value = {**value, "asset": {"provider": "spotify", "id": "a" * 22}}
        value["cacheKey"] = hashlib.sha256(b"1:spotify:aaaaaaaaaaaaaaaaaaaaaa").hexdigest()
        self.assertEqual(self.service.submit(value, value["cacheKey"])[0], 422)

    def test_timeout_releases_worker_and_retry_can_finish(self):
        self.service.processor = [sys.executable, "-c", "import time; time.sleep(30)"]
        self.service.timeout = .1
        self.service.start()
        value = job()
        self.service.submit(value, value["cacheKey"])
        deadline = time.monotonic() + 5
        while self.service.records[value["cacheKey"]]["state"] != "failed" and time.monotonic() < deadline:
            time.sleep(.02)
        record = self.service.records[value["cacheKey"]]
        self.assertEqual(record["reason"], "analysis_timeout")
        self.assertIsNone(self.service.child)
        record["updatedAt"] -= 61
        self.assertEqual(self.service.submit(value, value["cacheKey"])[1]["status"], "queued")

    def test_partial_output_remains_private_and_invalid_provider_is_rejected(self):
        value = job()
        directory = self.service.cache / value["cacheKey"]
        directory.mkdir()
        (directory / "0.json").write_text('{"events":[]}', encoding="utf-8")
        self.assertEqual(self.request(f'/cache/{value["cacheKey"]}/0.json')[0], 404)
        self.assertEqual(self.request("/analyze", {**value, "asset": {"provider": [], "id": "abcdefghijk"}},
                                      self.token, value["cacheKey"])[0], 400)


if __name__ == "__main__":
    unittest.main()
