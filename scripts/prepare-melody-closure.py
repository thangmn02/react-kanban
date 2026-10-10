"""One private phrase-first listening pass. No publication or provider fetch."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]


def command(args, timeout=30):
    subprocess.run([str(value) for value in args], check=True, timeout=timeout,
                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1048576), b""):
            digest.update(block)
    return digest.hexdigest()


def listen_audio(original, rate, notes, directory):
    mix = original * .7
    pitches = np.zeros_like(original)
    click_samples = np.arange(round(rate * .025)) / rate
    click = .10 * np.sin(2 * np.pi * 1600 * click_samples) * np.hanning(len(click_samples))
    for note in notes:
        start = round(note["start"] * rate)
        count = min(round((note["end"] - note["start"]) * rate), len(mix) - start)
        if count <= 0:
            continue
        phase = np.arange(count) / rate
        envelope = np.minimum(1, phase / .015) * np.minimum(1, (count / rate - phase) / .04)
        pitches[start:start + count] += (.15 * np.sin(2 * np.pi * 440 * 2 ** ((note["pitch"] - 69) / 12) * phase) * envelope)[:, None]
        size = min(len(click), len(mix) - start)
        mix[start:start + size] += click[:size, None]
        pitches[start:start + size] += click[:size, None]
    sf.write(str(directory / "primary-clicks.wav"), np.clip(mix, -1, 1), rate)
    sf.write(str(directory / "selected-pitches.wav"), np.clip(pitches, -1, 1), rate)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "src-tauri/target/melody-closure"))
    parser.add_argument("--holdout", help="Authorized local audio; analyze only its first 30 seconds")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / "src-tauri/target"):
        raise ValueError("Private output must remain in ignored target")
    output.mkdir(parents=True, exist_ok=True)
    saved = ROOT / "src-tauri/target/primary-melody-holdouts"
    originals = ROOT / "src-tauri/target/melody-bus-ab"
    prior = json.loads((saved / "report.json").read_text())
    cases = [
        {
            "label": case["label"],
            "candidates": saved / str(i) / "candidates.json",
            "original": originals / str(i) / "original.wav",
            "failed": saved / str(i) / "primary-clicks.wav",
            "failedSwitches": case["sourceSwitches"],
            "failedAttacks": case["noteCount"],
        }
        for i, case in enumerate(prior["cases"])
    ]
    if args.holdout:
        destination = output / "holdout"
        destination.mkdir(exist_ok=True)
        import imageio_ffmpeg
        audio = destination / "original.wav"
        source = Path(args.holdout).resolve()
        if not source.is_file():
            raise ValueError("Missing authorized local input")
        identity = file_sha256(source)
        if (destination / "candidates.json").exists():
            provenance = destination / "runtime.json"
            if not provenance.is_file() or json.loads(provenance.read_text()).get("sourceSha256") != identity:
                raise ValueError("Saved holdout belongs to different audio; use a separate private output directory")
        if not (destination / "candidates.json").exists():
            command([imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-i", source,
                     "-t", "30", "-ar", "44100", "-ac", "2", audio])
            # Only the local bounded file reaches the established analyzer.
            # Never call its legacy provider resolver or download fallback.
            sys.path.insert(0, str(ROOT / "server/audio-analysis"))
            from analyze import analyze_audio
            started = time.monotonic()
            result = analyze_audio(audio, {"provider": "soundcloud", "id": "private-local/melody-holdout"}, destination)
            (destination / "candidates.json").write_text(json.dumps(result))
            (destination / "runtime.json").write_text(json.dumps({
                "analysisSeconds": time.monotonic() - started,
                "inputSeconds": result["duration"],
                "sourceSha256": identity,
            }))
        cases.append({
            "label": source.stem,
            "candidates": destination / "candidates.json",
            "original": audio,
            "failed": None,
            "failedSwitches": None,
            "failedAttacks": None,
        })
    reports = []
    for i, case in enumerate(cases):
        directory = output / str(i)
        directory.mkdir(exist_ok=True)
        started = time.monotonic()
        command([os.environ.get("NODE_BINARY", "node"), ROOT / "scripts/select-lead-source.mjs",
                 case["candidates"], directory / "primary.json", "--phrases"])
        analysis = json.loads((directory / "primary.json").read_text())
        original, rate = sf.read(str(case["original"]), dtype="float32", always_2d=True)
        shutil.copyfile(case["original"], directory / "original.wav")
        if case["failed"]:
            shutil.copyfile(case["failed"], directory / "failed.wav")
        listen_audio(original, rate, analysis["notes"], directory)
        decision = analysis["leadDecision"]
        reports.append({
            "label": case["label"],
            "directory": str(i),
            "duration": analysis["duration"],
            "audioSha256": hashlib.sha256(original.tobytes()).hexdigest(),
            "candidateSha256": hashlib.sha256(case["candidates"].read_bytes()).hexdigest(),
            "version": analysis["analysisVersion"],
            "notes": analysis["notes"],
            **decision,
            "failedAvailable": bool(case["failed"]),
            "failedSwitches": case["failedSwitches"],
            "failedAttacks": case["failedAttacks"],
            "postprocessAndArtifactSeconds": round(time.monotonic() - started, 3),
            "perceptualStatus": "awaiting-user-listening",
            "independentTimestampAccuracy": None,
        })
        print(json.dumps({"case": case["label"], "attacks": len(analysis["notes"]), "switches": decision["sourceSwitches"]}), flush=True)
    (output / "report.json").write_text(json.dumps({"cases": reports}, indent=2))
    data = json.dumps(reports).replace("<", "\\u003c")
    (output / "listen.html").write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Private primary Melody closure comparison</title><style>
body{background:#131725;color:#eef0f8;font:16px system-ui;margin:24px auto;padding:0 16px;max-width:1050px}select,button,textarea{font:inherit;background:#252d43;color:inherit;border:1px solid #8290b4;border-radius:8px;padding:10px;margin:4px}audio,canvas{width:100%}canvas{background:#20263a;border-radius:10px}textarea{width:95%;height:70px}pre{white-space:pre-wrap;font-size:14px}small{color:#b3bfdc}.controls{display:flex;flex-wrap:wrap}#timestamps{max-height:240px;overflow:auto}.timeline-labels{display:flex;gap:18px;flex-wrap:wrap}
</style><h1>One primary Melody: phrase-first candidate</h1>
<p>Private listening review. Percussion and Bass are unchanged. This is not a production release or an accuracy score.</p>
<select id="track" aria-label="Excerpt"></select><div class="controls">
<button data-mode="original">Original music</button><button data-mode="primary-clicks">Original + Melody attack clicks</button>
<button data-mode="selected-pitches">Selected pitches + clicks (synthesized)</button><button data-mode="failed">Preserved failed tracker + clicks</button></div>
<audio controls></audio><p id="status" aria-live="polite"></p><canvas width="1050" height="155" aria-label="Source ownership and accepted Melody attacks"></canvas><p class="timeline-labels" id="legend"></p>
<details open><summary>Accepted Melody attack timestamps / pitches</summary><pre id="timestamps"></pre></details>
<h2>Listening judgment</h2><p>Do clicks follow the important melody? Does ownership hand off plausibly? Empty or sparse output can be correct; a stable wrong owner still fails.</p>
<select id="judgment" aria-label="Listening judgment"><option value="pending">Not checked</option><option value="acceptable">Perceptually acceptable</option><option value="wrong">Wrong lead / false attacks</option><option value="missing">Too many missing melody attacks</option></select>
<textarea id="comments" aria-label="Listening comments" placeholder="Source handoffs, missed phrases, wrong attacks and approximate excerpt times"></textarea><button id="export">Export listening judgments</button><small>Selections are listening observations, not complete note ground truth. Reference timestamps are not overlaid unless alignment has been independently verified.</small>
<script>const cases=''' + data + ''';
const select=document.querySelector('#track'),audio=document.querySelector('audio'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),judgment=document.querySelector('#judgment'),comments=document.querySelector('#comments');
const colors={vocals:'#67dbb7',piano:'#a5b2ff',guitar:'#ffcf82',other:'#e6a5ff'};let mode='original',ticket=0;const reviews={};
cases.forEach((item,i)=>{const option=document.createElement('option');option.value=i;option.textContent=item.label;select.append(option)});
function load(time=0,playing=false){const id=++ticket,item=cases[select.value||0];audio.pause();audio.src=item.directory+'/'+mode+'.wav';audio.onloadedmetadata=()=>{if(id!==ticket)return;audio.currentTime=Math.min(time,audio.duration);if(playing)audio.play().catch(()=>{})};audio.load();document.querySelector('[data-mode="failed"]').disabled=!item.failedAvailable;document.querySelector('#timestamps').textContent=item.notes.map(n=>n.start.toFixed(3)+' s · MIDI '+n.pitch+' · hold '+(n.end-n.start).toFixed(3)+' s').join('\\n')||'No convincing Melody attacks.';judgment.value=reviews[item.label]?.judgment||'pending';comments.value=reviews[item.label]?.comments||'';}
select.onchange=()=>{if(mode==='failed'&&!cases[select.value].failedAvailable)mode='original';load()};
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{const time=audio.currentTime,playing=!audio.paused;mode=button.dataset.mode;load(time,playing)});
function save(){const item=cases[select.value||0];reviews[item.label]={judgment:judgment.value,comments:comments.value,audioSha256:item.audioSha256,version:item.version,origin:'human-listening',completeTimestampLabels:false};}
judgment.onchange=save;comments.oninput=save;
document.querySelector('#export').onclick=()=>{save();const url=URL.createObjectURL(new Blob([JSON.stringify(reviews,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='melody-listening-judgments.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function draw(){const item=cases[select.value||0],duration=item.duration;ctx.clearRect(0,0,1050,155);item.sections.forEach(s=>{ctx.fillStyle=colors[s.source]||'#394157';ctx.fillRect(s.start/duration*1050,20,(s.end-s.start)/duration*1050,35)});ctx.fillStyle='#edf1ff';item.notes.forEach(n=>ctx.fillRect(n.start/duration*1050,75,2,45));ctx.fillStyle='#ffee8c';ctx.fillRect(audio.currentTime/duration*1050,0,2,155);const section=item.sections.find(s=>audio.currentTime>=s.start&&audio.currentTime<s.end);document.querySelector('#status').textContent=item.version+' · '+item.label+' · '+mode+' · '+audio.currentTime.toFixed(2)+' s · owner: '+(section?.source||'ambiguous / silent')+' · '+item.notes.length+' attacks · '+item.sourceSwitches+' handoffs';document.querySelector('#legend').textContent=Object.entries(colors).map(([name])=>name).join(' · ')+' · dark = abstention';requestAnimationFrame(draw)}load();draw();</script></html>''', encoding="utf-8")


if __name__ == "__main__":
    main()
