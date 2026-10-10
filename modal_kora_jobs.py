"""Real CPU range worker. Deploy: modal deploy modal_kora_jobs.py."""
from __future__ import annotations
import os
from pathlib import Path
import runpy
import secrets
import uuid
import modal

app = modal.App("kora-beat-analysis")
root = Path(__file__).parent
allowed = {"package.json", "server/audio-analysis/Dockerfile", "server/audio-analysis/requirements.txt",
           "server/audio-analysis/service.py", "server/audio-analysis/analyze.py", "server/lead-note-selection.ts", "server/primary-melody-tracker.ts",
           "scripts/import-beat-analysis.mjs", "scripts/select-lead-source.mjs", "scripts/extract-low-pulses.mjs",
           "src/features/music/event-track.ts", "src/features/music/lead-events.ts", "extensions/kanban-music/media-asset.js", "extensions/kanban-music/beat-detector.js"}
def ignore_build_path(path):
    candidate = Path(path)
    if candidate.is_absolute():
        candidate = candidate.relative_to(root)
    relative = candidate.as_posix()
    return relative != "." and not any(relative == entry or entry.startswith(relative + "/") for entry in allowed)
heavy_image = modal.Image.from_dockerfile(root / "server/audio-analysis/Dockerfile", context_dir=root, ignore=ignore_build_path)
lead_enabled = os.environ.get("BEAT_LEAD_PIPELINE") == "true"
if lead_enabled:
    # The tested Essentia wheel is CPython 3.14-only. Keep Torch on Python 3.10.
    heavy_image = heavy_image.dockerfile_commands("USER root").pip_install("uv==0.12.10").env({"UV_PYTHON_INSTALL_DIR": "/opt/lead-python"}).run_commands(
        "uv python install 3.14.4",
        "uv venv --python 3.14.4 /opt/lead-venv",
        "uv pip install --python /opt/lead-venv/bin/python numpy==2.5.3 essentia==2.1b6.dev1438",
        "chmod -R a+rX /opt/lead-python /opt/lead-venv").dockerfile_commands("USER analysis")
for relative in ("server/audio-analysis/range-analysis.py", "server/audio-analysis/lead-pulse.py", "server/audio-analysis/run-lead-pulse.py", "server/lead-note-selection.ts", "server/primary-melody-tracker.ts", "scripts/export-beat-range.mjs"):
    heavy_image = heavy_image.add_local_file(root / relative, "/app/" + relative)
gateway_image = modal.Image.debian_slim(python_version="3.10").pip_install("fastapi[standard]==0.115.14")
gateway_image = gateway_image.add_local_file(root / "server/audio-analysis/private-inputs.py", "/app/private-inputs.py")
with gateway_image.imports():
    from fastapi import Request, HTTPException
credentials = modal.Secret.from_name("kora-beat-analysis")
gateway_credentials = modal.Secret.from_name("kora-beat-gateway")
models = modal.Volume.from_name("kora-beat-models", create_if_missing=True)
fixtures = modal.Volume.from_name("kora-beat-private-fixtures", create_if_missing=True)


@app.function(image=heavy_image, secrets=[credentials], cpu=2, memory=8192, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=60,
              volumes={"/models": models, "/fixtures": fixtures},
              env={"BEAT_ANALYSIS_THREADS": "2", "BEAT_FIXTURE_DIRECTORY": "/fixtures", "TORCH_HOME": "/models",
                   "BEAT_LEAD_PIPELINE": "true" if lead_enabled else "false",
                   "BEAT_LEAD_PYTHON": "/opt/lead-venv/bin/python" if lead_enabled else ""})
def analyze_range(job_id: str):
    import sys
    import resource
    import time
    beginning = time.monotonic()
    before = [resource.getrusage(target) for target in (resource.RUSAGE_SELF, resource.RUSAGE_CHILDREN)]
    sys.path.insert(0, "/app/server/audio-analysis")
    result = runpy.run_path("/app/server/audio-analysis/range-analysis.py")["run_range"](job_id)
    models.commit()
    after = [resource.getrusage(target) for target in (resource.RUSAGE_SELF, resource.RUSAGE_CHILDREN)]
    return {**result, "wallSeconds": time.monotonic() - beginning,
            "cpuSeconds": sum(value.ru_utime + value.ru_stime for value in after) - sum(value.ru_utime + value.ru_stime for value in before),
            "containerPeakResidentMiB": after[0].ru_maxrss / 1024}


@app.function(image=gateway_image, secrets=[gateway_credentials], min_containers=0, max_containers=1)
@modal.fastapi_endpoint(method="POST")
async def enqueue(request: Request):
    expected = os.environ["BEAT_ANALYSIS_KEY"]
    if not secrets.compare_digest(request.headers.get("authorization", ""), "Bearer " + expected):
        raise HTTPException(status_code=401, detail="unauthorized")
    raw = await request.body()
    if len(raw) > 2048:
        raise HTTPException(status_code=400, detail="invalid_request")
    import json
    try:
        body = json.loads(raw)
        identity = str(uuid.UUID(body["jobId"]))
        if body["schemaVersion"] != 2:
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=400, detail="invalid_request") from None
    # Database ownership and demand are checked before input/models/inference.
    call = await analyze_range.spawn.aio(identity)
    from fastapi.responses import JSONResponse
    return JSONResponse({"status": "pending", "jobId": identity, "callId": call.object_id}, status_code=202)


@app.local_entrypoint()
def main(job_id: str):
    """Run an admitted real range, report timing only; no dummy events."""
    identity = str(uuid.UUID(job_id))
    print(analyze_range.remote(identity))


@app.function(image=gateway_image, secrets=[credentials], min_containers=0, max_containers=1,
              timeout=300, schedule=modal.Period(hours=1))
def expire_audio_inputs():
    # Raw capture is short-lived even if a gateway/worker crashes before cleanup.
    cleanup = runpy.run_path("/app/private-inputs.py")["cleanup_expired_inputs"]
    return cleanup(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
