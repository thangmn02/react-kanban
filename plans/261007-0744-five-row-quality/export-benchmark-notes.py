# Paste this cell into the existing Colab notebook after its accepted lead tests.
# It only saves existing results; it does not install or run any model.
import json
from pathlib import Path
from google.colab import files

required = ["gym_bp_notes", "gym_lead_v2", "hskt_other_notes", "hskt_lead_v3"]
missing = [name for name in required if name not in globals()]
if missing:
    raise RuntimeError("The Colab runtime no longer holds: " + ", ".join(missing)
                       + ". Run the notebook's existing accepted lead tests first.")

def plain_notes(notes):
    return [{"start": float(n["start"]), "end": float(n["end"]),
             "pitch": int(n["pitch"]), "amp": float(n["amp"])} for n in notes]

result = {"version": 1, "gymnopedie": {
    "raw": plain_notes(gym_bp_notes), "selected": plain_notes(gym_lead_v2)},
    "lee_hi_hskt": {
    "raw": plain_notes(hskt_other_notes), "selected": plain_notes(hskt_lead_v3)}}
destination = Path("/content/kora-lead-reference.json")
destination.write_text(json.dumps(result, indent=2), encoding="utf-8")
print("Saved existing lead notes to", destination)
files.download(str(destination))
