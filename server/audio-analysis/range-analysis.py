"""Bounded CPU analysis and private sparse publication, behind AnalysisService."""
from __future__ import annotations
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import time
from typing import Protocol
from urllib.parse import urlparse, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from analyze import analyze_audio, command, PROJECT

VERSION = "server-primary-melody-range-v1"
LEAD_VERSION = "server-lead-pulse-range-v1"
MAX_INPUT_BYTES = 44 + 65 * 16000 * 2


class SupabaseCache:
    def __init__(self):
        self.origin = os.environ["SUPABASE_URL"].rstrip("/")
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        if urlparse(self.origin).scheme != "https":
            raise ValueError("invalid_cache_origin")

    def request(self, path, body=None, method=None, raw=False):
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        request = Request(self.origin + path, data=data, method=method,
                          headers={"apikey": self.key, "Authorization": "Bearer " + self.key,
                                   "Content-Type": "application/json", "Prefer": "return=representation"})
        with urlopen(request, timeout=8) as response:
            result = response.read(524289)
        if len(result) > 524288:
            raise ValueError("oversized_cache_response")
        return result if raw else json.loads(result) if result else None

    def rpc(self, name, body):
        return self.request("/rest/v1/rpc/" + name, body)

    def active(self, job):
        sampled_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        rows = self.request(f'/rest/v1/beat_analysis_demands?track_id=eq.{job["trackId"]}&expires_at=gt.{sampled_at}'
                            f'&range_start=lt.{job["requestedRange"]["end"]}&range_end=gt.{job["requestedRange"]["start"]}&select=id&limit=1')
        return bool(rows)

    def finish_failure(self, identity, reason):
        self.request(f"/rest/v1/beat_analysis_jobs?id=eq.{identity}&state=eq.running", {
            "state": "input_unavailable" if reason == "input_unavailable" else "cancelled" if reason == "demand_expired" else "failed",
            "failure_code": reason, "retry_after": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + (3600 if reason == "input_unavailable" else 60)))}, "PATCH")


class AudioInputResolver(Protocol):
    def resolve(self, job: dict, work: Path) -> tuple[Path, float, float]: ...


def validate_job(job):
    start, end, duration = job["requestedRange"]["start"], job["requestedRange"]["end"], job["duration"]
    allowed = job["analysisVersion"] == VERSION or os.environ.get("BEAT_LEAD_PIPELINE")=="true" and job["analysisVersion"]==LEAD_VERSION
    if not allowed or not all(isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) for n in (start, end, duration)):
        raise ValueError("invalid_range")
    if start < 0 or start % 30 or end <= start or end-start > 300 or end > duration or duration > 864000:
        raise ValueError("invalid_range")
    return max(0, start-5), min(duration, end+5)


class AuthorizedAudioInput:
    """Private fixtures or explicitly registered signed segments; no provider scraping."""
    def __init__(self, cache):
        self.cache = cache
        self.registered = []

    def resolve(self, job, work):
        import imageio_ffmpeg
        import soundfile as sf
        beginning, end = validate_job(job)
        key = hashlib.sha256(f'{job["asset"]["provider"]}:{job["asset"]["id"]}'.encode()).hexdigest()
        root = os.environ.get("BEAT_FIXTURE_DIRECTORY")
        local = Path(root) / (key + ".wav") if root else None
        offset = 0.0
        if local and local.is_file():
            # This is an explicitly uploaded private fixture, never a provider
            # fallback. Read only the requested samples, even for long fixtures.
            info = sf.info(str(local))
            if end > info.duration + .02:
                raise ValueError("input_unavailable")
            data, rate = sf.read(str(local), start=round(beginning*info.samplerate), stop=round(end*info.samplerate), always_2d=True, dtype="float32")
            source = work / "input.wav"
            sf.write(str(source), data, rate)
            offset = beginning
        else:
            try:
                manifest = self.cache.request(f'/storage/v1/object/authenticated/beat-audio-inputs/{key}/{job["jobId"]}.json')
            except HTTPError as error:
                if error.code in (400, 404):
                    raise ValueError("input_unavailable") from None
                raise
            # Only the protected gateway registers absolute media-clock bounds.
            if not isinstance(manifest, dict) or not isinstance(manifest.get("start"), (int, float)) or not isinstance(manifest.get("end"), (int, float)):
                raise ValueError("input_unavailable")
            offset, segment_end = manifest["start"], manifest["end"]
            if not all(math.isfinite(n) for n in (offset, segment_end)) or offset < 0 or offset > job["requestedRange"]["start"] or segment_end < job["requestedRange"]["end"] or segment_end-offset > 65:
                raise ValueError("input_unavailable")
            path = manifest.get("inputPath", "")
            import re
            from datetime import datetime, timezone
            expires = datetime.fromisoformat(str(manifest.get("expiresAt", "")).replace("Z", "+00:00"))
            if (not re.fullmatch(key + r"/[0-9]{13}-[a-f0-9-]{36}\.wav", path)
                    or expires.tzinfo is None or expires <= datetime.now(timezone.utc)
                    or manifest.get("playbackRate") != 1 or manifest.get("jobId") != job["jobId"]):
                raise ValueError("input_unavailable")
            self.registered.append((path, f"{key}/{job['jobId']}.json"))
            # Live capture has historical context only. Never ask the client for
            # future audio, pad missing media, or relabel past notes as current.
            beginning, end = max(beginning, offset), min(end, segment_end)
            location = self.cache.origin + "/storage/v1/object/authenticated/beat-audio-inputs/" + path
            source = work / "input.audio"
            with urlopen(Request(location, headers={"apikey": self.cache.key, "Authorization": "Bearer " + self.cache.key}), timeout=15) as response, source.open("wb") as destination:
                final = urlparse(response.geturl())
                if final.scheme != "https" or final.hostname != urlparse(self.cache.origin).hostname:
                    raise ValueError("input_unavailable")
                size = 0
                while block := response.read(65536):
                    size += len(block)
                    if size > MAX_INPUT_BYTES:
                        raise ValueError("input_unavailable")
                    destination.write(block)
        output = work / "audio.wav"
        command([imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-ss", beginning-offset, "-i", source,
                 "-t", end-beginning, "-ar", "44100", "-ac", "2", output], timeout=60)
        info = sf.info(str(output))
        if abs(info.duration - (end-beginning)) > .05 or info.duration > 310:
            raise ValueError("input_unavailable")
        return output, beginning, info.duration

    def cleanup(self):
        for raw_path, manifest_path in self.registered:
            # Unique raw objects always belong to this attempt. If a later
            # attempt replaced the manifest, its input must remain intact.
            prefixes = [raw_path]
            try:
                current = self.cache.request("/storage/v1/object/authenticated/beat-audio-inputs/" + manifest_path)
                if current.get("inputPath") == raw_path:
                    prefixes.append(manifest_path)
            except HTTPError as error:
                if error.code not in (400, 404):
                    raise
            self.cache.request("/storage/v1/object/beat-audio-inputs", {"prefixes": prefixes}, "DELETE")


def run_range(identity, cache=None, resolver=None):
    cache = cache or SupabaseCache()
    started = time.monotonic()
    job = cache.rpc("start_beat_job", {"p_job": identity})
    if not job:
        return {"status": "cancelled", "reason": "demand_expired_or_owned"}
    stage = "demand"
    input_resolver = resolver or AuthorizedAudioInput(cache)
    try:
        validate_job(job)
        if not cache.active(job):
            raise ValueError("demand_expired")
        with tempfile.TemporaryDirectory(prefix="kora-range-") as directory:
            work = Path(directory)
            stage = "input"
            audio, offset, context_seconds = input_resolver.resolve(job, work)
            # Model imports are below both demand and input checks. A supported
            # cache miss never incurs inference while waiting for unavailable audio.
            stage = "inference"
            result = analyze_audio(audio, job["asset"], work, lambda: cache.active(job),
                                   **({"lead_enabled":True} if job["analysisVersion"]==LEAD_VERSION else {}))
            source = work / "candidates.json"
            source.write_text(json.dumps({**result, "job": job, "offset": offset}), encoding="utf-8")
            output = work / "output"
            stage = "normalization"
            command([os.environ.get("NODE_BINARY", "node"), PROJECT / "scripts/export-beat-range.mjs", source, output], timeout=30)
            result = json.loads((output / "result.json").read_text())
            descriptors = []
            # Every immutable object uploads before one atomic publication RPC.
            # Readers cannot see partially ready ranges if upload fails midway.
            stage = "publication"
            for descriptor in result["chunks"]:
                payload = (output / f'{descriptor["index"]}.json').read_bytes()
                path = f'{job["trackId"]}/{identity}/{descriptor["revision"]}.json'
                cache.request("/storage/v1/object/beat-event-tracks/" + quote(path, safe="/"), payload, "POST")
                descriptors.append({**descriptor, "path": path})
            runtime = time.monotonic()-started
            published = cache.rpc("publish_beat_range", {"p_job": identity, "p_chunks": descriptors, "p_runtime": runtime,
                                  "p_context": context_seconds, "p_lead": result["leadDecision"]})
            if not published:
                raise ValueError("publication_owner_expired")
            return {"status": "completed", "eventCount": result["eventCount"], "runtimeSeconds": runtime,
                    "uniqueUncachedAudioSecondsAnalyzed": job["requestedRange"]["end"]-job["requestedRange"]["start"], "contextAudioSeconds": context_seconds}
    except Exception as error:
        reason = str(error) if isinstance(error, ValueError) and str(error) in ("input_unavailable", "demand_expired", "invalid_range", "publication_owner_expired") else "analysis_failed"
        cache.finish_failure(identity, reason)
        # Never log upstream URLs, signed query strings, credentials or raw audio.
        return {"status": "input_unavailable" if reason == "input_unavailable" else "failed", "reason": reason,
                "stage": stage, "errorClass": type(error).__name__}
    finally:
        if hasattr(input_resolver, "cleanup"):
            try:
                input_resolver.cleanup()
            except Exception:
                # The separate expiry sweep removes failed-job/orphan inputs.
                print(json.dumps({"stage": "private-input-cleanup", "status": "retry-required"}), flush=True)
