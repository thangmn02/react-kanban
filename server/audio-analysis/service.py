"""Bounded single-worker analysis service; only event JSON is public."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

RULES = {"youtube": r"[\w-]{11}", "soundcloud": r"[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+",
         "spotify": r"[a-zA-Z0-9]{22}", "deezer": r"\d+", "tidal": r"\d+", "apple": r"\d+"}


def parse_job(value):
    if not isinstance(value, dict):
        raise ValueError("invalid_job")
    asset = value.get("asset", {})
    if not isinstance(asset, dict):
        raise ValueError("invalid_asset")
    provider, identity = asset.get("provider"), asset.get("id")
    if not isinstance(provider, str) or provider not in RULES or not isinstance(identity, str) or len(identity) > 200 \
            or not re.fullmatch(RULES[provider], identity, flags=re.ASCII) \
            or provider == "soundcloud" and identity.split("/")[0] in ("search", "discover", "stream", "you", "charts"):
        raise ValueError("invalid_asset")
    key = hashlib.sha256(f"1:{provider}:{identity}".encode()).hexdigest()
    if value.get("version") != 1 or value.get("chunkSeconds") != 30 \
            or value.get("melodyPolicy") != "dominant-monophonic" or value.get("cacheKey") != key:
        raise ValueError("invalid_job")
    return {"version": 1, "asset": {"provider": provider, "id": identity}, "cacheKey": key,
            "chunkSeconds": 30, "melodyPolicy": "dominant-monophonic"}


def save_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    os.replace(temporary, path)


class AnalysisService:
    def __init__(self, directory, token, processor=None, pending_limit=8, timeout=3600):
        if len(token) < 32:
            raise ValueError("Use a service token of at least 32 characters")
        self.root = Path(directory).resolve()
        self.token, self.pending_limit, self.timeout = token, pending_limit, timeout
        self.jobs = self.root / "jobs"
        self.cache = self.root / "cache"
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.processor = processor or [sys.executable, "-u", str(Path(__file__).with_name("analyze.py"))]
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.stopping = threading.Event()
        self.child = None
        self.records = {}
        for path in sorted(self.jobs.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            job = parse_job(record["job"])
            if path.stem != job["cacheKey"]:
                raise ValueError("Invalid stored job identity")
            if record["state"] == "running":
                record.update(state="queued", updatedAt=time.time())
                save_json(path, record)
            self.records[path.stem] = record
        if sum(r["state"] == "queued" for r in self.records.values()) > pending_limit:
            raise ValueError("Stored backlog exceeds configured capacity")
        self.thread = threading.Thread(target=self.run, name="audio-analysis", daemon=True)

    def start(self):
        self.thread.start()
        self.wake.set()

    def available_source(self, job):
        if job["asset"]["provider"] in ("youtube", "soundcloud"):
            return True
        source = os.environ.get("BEAT_MEDIA_DIRECTORY")
        return bool(source and (Path(source) / f'{job["cacheKey"]}.wav').is_file())

    def submit(self, value, idempotency):
        job = parse_job(value)
        key = job["cacheKey"]
        if idempotency != key:
            return 400, {"error": "invalid_idempotency"}
        if not self.available_source(job):
            return 422, {"status": "unsupported_source"}
        with self.lock:
            previous = self.records.get(key)
            if previous and previous["state"] in ("queued", "running", "complete"):
                if previous["state"] != "complete" or (self.cache / key / "manifest.json").is_file():
                    return 202, {"jobId": key, "status": previous["state"]}
            if previous and time.time() - previous["updatedAt"] < 60:
                return 429, {"status": "limited", "retryAfter": 60}
            if sum(r["state"] in ("queued", "running") for r in self.records.values()) >= self.pending_limit \
                    or key not in self.records and len(self.records) >= 1000:
                return 503, {"status": "busy"}
            record = {"job": job, "state": "queued", "updatedAt": time.time()}
            save_json(self.jobs / f"{key}.json", record)
            self.records[key] = record
            self.wake.set()
            return 202, {"jobId": key, "status": "queued"}

    def run(self):
        while not self.stopping.is_set():
            self.wake.wait(.5)
            self.wake.clear()
            with self.lock:
                pending = [(key, r) for key, r in self.records.items() if r["state"] == "queued"]
                if not pending:
                    continue
                key, record = min(pending, key=lambda item: item[1]["updatedAt"])
                record.update(state="running", updatedAt=time.time())
                save_json(self.jobs / f"{key}.json", record)
            state, reason = "failed", "analysis_failed"
            try:
                command = self.processor + [str(self.jobs / f"{key}.json"), str(self.cache)]
                with (self.jobs / f"{key}.log").open("w", encoding="utf-8") as log:
                    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                    with self.lock:
                        if self.stopping.is_set():
                            break
                        self.child = subprocess.Popen(command, stdout=log, stderr=log,
                                                      start_new_session=os.name != "nt", creationflags=flags)
                    try:
                        result = self.child.wait(timeout=self.timeout)
                    except subprocess.TimeoutExpired:
                        self.kill_child()
                        raise
                    if result == 0 and (self.cache / key / "manifest.json").is_file():
                        state, reason = "complete", None
            except subprocess.TimeoutExpired:
                reason = "analysis_timeout"
            except (OSError, ValueError):
                reason = "analysis_failed"
            finally:
                with self.lock:
                    self.child = None
                    record.update(state="queued" if self.stopping.is_set() else state,
                                  updatedAt=time.time(), reason=reason)
                    save_json(self.jobs / f"{key}.json", record)
                    if any(r["state"] == "queued" for r in self.records.values()):
                        self.wake.set()

    def kill_child(self):
        with self.lock:
            child = self.child
            if child and child.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW, check=False)
                else:
                    os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    if os.name != "nt":
                        os.killpg(child.pid, signal.SIGKILL)
                    child.wait()

    def close(self):
        self.stopping.set()
        self.wake.set()
        self.kill_child()
        if self.thread.is_alive():
            self.thread.join(timeout=10)


def handler_for(service):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def log_message(self, *_):
            pass  # No account data, auth headers or request bodies in access logs.

        def reply(self, status, value):
            body = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if urlsplit(self.path).path != "/analyze":
                return self.reply(404, {"error": "not_found"})
            if not hmac.compare_digest(self.headers.get("Authorization", "").encode(), f"Bearer {service.token}".encode()):
                return self.reply(401, {"error": "unauthorized"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 2048:
                    return self.reply(413, {"error": "invalid_size"})
                value = json.loads(self.rfile.read(length))
                status, result = service.submit(value, self.headers.get("Idempotency-Key"))
                return self.reply(status, result)
            except (ValueError, TypeError, OSError):
                return self.reply(400, {"error": "invalid_job"})

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/health":
                return self.reply(200, {"status": "ready", "workerAlive": service.thread.is_alive()})
            match = re.fullmatch(r"/cache/([a-f0-9]{64})/(manifest|\d{1,5})\.json", path)
            if not match:
                return self.reply(404, {"error": "not_found"})
            key, name = match.groups()
            directory = service.cache / key
            # Staged/failed jobs never expose partial cache output.
            if not (directory / "manifest.json").is_file():
                return self.reply(404, {"status": "miss"})
            try:
                source = directory / f"{name}.json"
                if source.stat().st_size > 524288:
                    return self.reply(502, {"error": "invalid_cache"})
                return self.reply(200, json.loads(source.read_text(encoding="utf-8")))
            except FileNotFoundError:
                return self.reply(404, {"status": "miss"})
            except (OSError, ValueError):
                return self.reply(502, {"error": "invalid_cache"})

    return Handler


if __name__ == "__main__":
    analysis = AnalysisService(os.environ.get("BEAT_ANALYSIS_DIRECTORY", "/data"), os.environ["BEAT_ANALYSIS_KEY"])
    server = ThreadingHTTPServer((os.environ.get("BEAT_ANALYSIS_BIND", "127.0.0.1"),
                                 int(os.environ.get("PORT", "47700"))), handler_for(analysis))
    analysis.start()
    # shutdown must run outside serve_forever's thread; SIGTERM is the normal
    # container stop signal and must also terminate our owned inference child.
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown, daemon=True).start())
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        analysis.close()
