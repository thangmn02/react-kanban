"""Private primary-voice listening evidence; no uploads or song-specific tuning."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import numpy as np
import soundfile as sf
import basic_pitch
from basic_pitch.inference import Model, predict

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saved", required=True, help="Existing private MelodyBus comparison directory")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    saved = Path(args.saved).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    reference = json.loads((saved / "report.json").read_text())
    model = Model(Path(basic_pitch.__file__).parent / "saved_models/icassp_2022/nmp.onnx")
    reports = []
    for index, case in enumerate(reference["cases"]):
        beginning = time.monotonic()
        source = saved / str(index)
        destination = output / str(index)
        destination.mkdir(exist_ok=True)
        value = json.loads((source / "analysis.json").read_text())
        vocal_file = destination / "vocals.wav"
        measured_vocals = not (destination / "candidates.json").exists()
        if measured_vocals:
            packed = np.load(next(source.glob("stems-*.npz")))
            sf.write(str(vocal_file), packed["vocals"], int(packed["rate"]))
            _, _, raw = predict(vocal_file, model, onset_threshold=.50, frame_threshold=.30, minimum_note_length=100)
            vocals = {"source": "vocals", "energy": float(np.mean(packed["vocals"] ** 2)), "notes": [
                {"start": float(a), "end": min(float(b), value["duration"]), "pitch": int(pitch), "amp": float(amp)}
                for a, b, pitch, amp, _ in raw if 0 <= a < value["duration"] and min(b, value["duration"]) > a]}
            value["candidates"] = [candidate for candidate in value["candidates"] if candidate["source"] != "vocals"] + [vocals]
            (destination / "candidates.json").write_text(json.dumps(value))
        candidates = destination / "candidates.json"
        analysis = destination / "primary.json"
        subprocess.run([os.environ.get("NODE_BINARY", "node"), str(ROOT / "scripts/select-lead-source.mjs"),
                        str(candidates), str(analysis)], check=True, capture_output=True, timeout=30)
        tracked = json.loads(analysis.read_text())
        original, rate = sf.read(str(source / "original.wav"), always_2d=True, dtype="float32")
        mixed = original.copy() * .7
        click_time = np.arange(round(rate * .025)) / rate
        click = .10 * np.sin(2 * np.pi * 1600 * click_time) * np.hanning(len(click_time))
        for note in tracked["notes"]:
            start = round(note["start"] * rate)
            size = min(len(click), len(mixed) - start)
            if size > 0:
                mixed[start:start+size] += click[:size, None]
        sf.write(str(destination / "primary-clicks.wav"), np.clip(mixed, -1, 1), rate)
        decision = tracked["leadDecision"]
        reports.append({"label": case["label"], "duration": value["duration"], **decision,
                        "noteCount": len(tracked["notes"]), "notes": tracked["notes"],
                        "runtimeSeconds": round(time.monotonic()-beginning, 3),
                        "baselineEvents": case["A"]["events"],
                        "perceptualStatus": "listening-required", "vocalCandidatesMeasured": True,
                        "runtimeIncludesVocalInference": measured_vocals, "reusesSavedSeparation": True})
        print(json.dumps({"case": index, "notes": len(tracked["notes"]), "switches": decision["sourceSwitches"]}), flush=True)
    (output / "report.json").write_text(json.dumps({"cases": reports}, indent=2))
    rows = [{"label": case["label"], "directory": str(index), "original": (saved / str(index) / "original.wav").as_uri(),
             "baseline": (saved / str(index) / "A.wav").as_uri(), "notes": case["notes"], "sections": case["sections"]} for index, case in enumerate(reports)]
    (output / "listen.html").write_text('''<!doctype html><meta charset="utf-8"><title>Primary Melody listening review</title>
<style>body{background:#10131b;color:#eef1fa;font:16px system-ui;max-width:950px;margin:40px auto}button,select{padding:10px;margin:5px;background:#252b3e;color:inherit;border:1px solid #626b86;border-radius:8px}audio,canvas{width:100%}#status{white-space:pre-wrap}</style>
<h1>One primary melody voice</h1><p>Compare the important melody attacks and source handoffs. Counts do not prove accuracy.</p>
<select id="track"></select><button data-mode="original">Original</button><button data-mode="baseline">Previous lead + clicks</button><button data-mode="primary">Primary voice + clicks</button>
<audio controls></audio><canvas width="950" height="160"></canvas><p id="status"></p><script>
const cases=''' + json.dumps(rows) + ''';const select=document.querySelector('select'),audio=document.querySelector('audio'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let mode='original';
cases.forEach((item,index)=>{const option=document.createElement('option');option.value=index;option.textContent=item.label;select.append(option)});
function load(){const item=cases[select.value||0];audio.src=mode==='primary'?item.directory+'/primary-clicks.wav':item[mode];}
select.onchange=load;document.querySelectorAll('button').forEach(button=>button.onclick=()=>{const time=audio.currentTime,playing=!audio.paused;mode=button.dataset.mode;load();audio.onloadedmetadata=()=>{audio.currentTime=Math.min(time,audio.duration);if(playing)audio.play()}});
function draw(){const item=cases[select.value||0],duration=audio.duration||30;ctx.clearRect(0,0,950,160);item.sections.forEach(section=>{ctx.fillStyle=section.source==='vocals'?'#66dfb6':section.source?'#b1a1ff':'#303749';ctx.fillRect(section.start/duration*950,20,(section.end-section.start)/duration*950,32)});ctx.fillStyle='#edf1ff';item.notes.forEach(note=>ctx.fillRect(note.start/duration*950,80,2,45));ctx.fillStyle='#ffdd77';ctx.fillRect(audio.currentTime/duration*950,0,2,160);const section=item.sections.find(section=>audio.currentTime>=section.start&&audio.currentTime<section.end);document.querySelector('#status').textContent=item.label+' · '+mode+'\\nPrimary source: '+(section?.source||'ambiguous/silent');requestAnimationFrame(draw)}load();draw();</script>''', encoding="utf-8")


if __name__ == "__main__":
    main()
