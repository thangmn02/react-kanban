"""Private raw-input expiry sweep; no model loading or persistent compute."""
import json
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.parse import urlparse


def cleanup_expired_inputs(origin, key, now=None, request=None):
    if urlparse(origin).scheme != "https":
        raise ValueError("invalid_storage_origin")
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(hours=1)

    def storage(path, body, method="POST"):
        with urlopen(Request(origin.rstrip("/") + "/storage/v1/" + path,
                             data=json.dumps(body).encode(), method=method,
                             headers={"apikey": key, "Authorization": "Bearer " + key,
                                      "Content-Type": "application/json"}), timeout=15) as response:
            return json.loads(response.read(524288))

    call = request or storage
    deleted = scanned = 0
    folder_offset = 0
    folders = []
    # Snapshot bounded folder names before deletions change paginated offsets.
    while folder_offset < 10000:
        page = call("object/list/beat-audio-inputs", {"prefix": "", "limit": 100, "offset": folder_offset,
                                                   "sortBy": {"column": "name", "order": "asc"}})
        folders.extend(page)
        if len(page) < 100:
            break
        folder_offset += 100
    for folder in folders:
        import re
        if not re.fullmatch(r"[a-f0-9]{64}", folder.get("name", "")):
            continue
        offset = 0
        while scanned < 10000:
            objects = call("object/list/beat-audio-inputs", {"prefix": folder["name"], "limit": 100, "offset": offset,
                                                               "sortBy": {"column": "name", "order": "asc"}})
            if not objects:
                break
            expired = []
            for value in objects:
                scanned += 1
                stamp = value.get("updated_at") or value.get("created_at")
                if not stamp or not value.get("id"):
                    continue
                time = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
                if time.tzinfo is not None and time <= cutoff:
                    expired.append(folder["name"] + "/" + value["name"])
            if expired:
                call("object/beat-audio-inputs", {"prefixes": expired}, "DELETE")
                deleted += len(expired)
            if len(objects) < 100:
                break
            offset += len(objects) - len(expired)
    return {"deleted": deleted, "scanned": scanned, "bounded": scanned >= 10000}
