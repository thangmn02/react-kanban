"""Create server-only Modal secrets via CLI auth; retain encrypted local config."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import secrets
import subprocess
import modal

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path(os.environ["USERPROFILE"]) / "KoraBackups" / "beat-analysis-runtime" / "credentials.json.dpapi"


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_byte))]


def protected(data, decrypt=False):
    buffer = ctypes.create_string_buffer(data)
    incoming = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    outgoing = Blob()
    api = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    if not api(ctypes.byref(incoming), None, None, None, None, 1, ctypes.byref(outgoing)):
        raise RuntimeError("Windows credential encryption failed")
    try:
        return ctypes.string_at(outgoing.data, outgoing.size)
    finally:
        ctypes.windll.kernel32.LocalFree(outgoing.data)


def credentials():
    if PRIVATE.exists():
        return json.loads(protected(PRIVATE.read_bytes(), True))
    reference = (ROOT / "supabase/.temp/project-ref").read_text().strip()
    if len(reference) != 20 or not reference.isalpha():
        raise RuntimeError("Invalid linked project")
    # Capture the secret-bearing result. Neither diagnostics nor key values
    # are forwarded to stdout, exception messages or command arguments.
    process = subprocess.run([str(ROOT / "node_modules/.bin/supabase.cmd"), "projects", "api-keys",
                              "--project-ref", reference, "--reveal", "--output", "json"],
                             cwd=ROOT, capture_output=True, text=True, timeout=30)
    if process.returncode:
        raise RuntimeError("Authenticated project key lookup failed")
    keys = json.loads(process.stdout)
    key = next(item["api_key"] for item in keys if item["name"] == "service_role")
    anon = next(item["api_key"] for item in keys if item["name"] == "anon")
    value = {"SUPABASE_URL": f"https://{reference}.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": key,
             "SUPABASE_ANON_KEY": anon, "BEAT_ANALYSIS_KEY": secrets.token_urlsafe(48)}
    PRIVATE.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE.write_bytes(protected(json.dumps(value).encode()))
    return value


if __name__ == "__main__":
    value = credentials()
    modal.Secret.objects.create("kora-beat-analysis", {name: value[name] for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")}, allow_existing=True)
    modal.Secret.objects.create("kora-beat-gateway", {"BEAT_ANALYSIS_KEY": value["BEAT_ANALYSIS_KEY"]}, allow_existing=True)
    print(json.dumps({"configured": True, "credentialStorage": "Windows DPAPI CurrentUser", "serverOnly": True}))
