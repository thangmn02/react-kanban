"""Replaceable server baseline: model analysis -> selected lead -> EventTrack."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

PROJECT = Path(__file__).resolve().parents[2]
MAX_SECONDS = 7200
MAX_BYTES = 512 * 1024 * 1024
SEGMENT_SECONDS = 60


def command(arguments, timeout=300):
    sys.stdout.flush()
    sys.stderr.flush()
    subprocess.run([str(item) for item in arguments], check=True, timeout=timeout,
                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)


def resolve_audio(job, work):
    import imageio_ffmpeg
    from yt_dlp import YoutubeDL
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    media_root = os.environ.get("BEAT_MEDIA_DIRECTORY")
    local = Path(media_root) / f'{job["cacheKey"]}.wav' if media_root else None
    if local and local.is_file():
        source = local
    else:
        provider, identity = job["asset"]["provider"], job["asset"]["id"]
        if provider == "youtube":
            url = f"https://www.youtube.com/watch?v={identity}"
        elif provider == "soundcloud":
            url = f"https://soundcloud.com/{identity}"
        else:
            raise ValueError("unsupported_source")

        def bound_download(status):
            if status.get("downloaded_bytes", 0) > MAX_BYTES:
                raise ValueError("media_too_large")

        def bound_metadata(info, *, incomplete):
            if not incomplete and (info.get("is_live") or not info.get("duration") or info["duration"] > MAX_SECONDS):
                return "unsupported_duration"

        with YoutubeDL({"format": "bestaudio/best", "outtmpl": str(work / "source.%(ext)s"),
                        "noplaylist": True, "quiet": True, "no_warnings": True,
                        "socket_timeout": 15, "retries": 2, "fragment_retries": 2,
                        "max_filesize": MAX_BYTES, "match_filter": bound_metadata,
                        "progress_hooks": [bound_download]}) as downloader:
            result = downloader.extract_info(url, download=True)
            if not result or result.get("is_live") or not result.get("duration") or result["duration"] > MAX_SECONDS:
                raise ValueError("unsupported_duration")
            source = Path(downloader.prepare_filename(result))
    if not source.is_file() or source.stat().st_size > MAX_BYTES:
        raise ValueError("media_unavailable")
    output = work / "audio.wav"
    command([ffmpeg, "-nostdin", "-v", "error", "-y", "-i", source,
             "-t", str(MAX_SECONDS + 1), "-ar", "44100", "-ac", "2", output])
    return output


def analyze_audio(audio, asset, work, keep_running=lambda: True, melodic_observer=None, lead_enabled=False):
    if not keep_running():
        raise ValueError("demand_expired")
    import numpy as np
    import soundfile as sf
    import torch
    import pretty_midi
    import basic_pitch
    from basic_pitch.inference import Model, predict
    from adtof_pytorch import transcribe_to_midi, get_default_weights_path
    from adtof_pytorch.model import create_frame_rnn_model, calculate_n_bins, load_pytorch_weights
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    torch.set_num_threads(int(os.environ.get("BEAT_ANALYSIS_THREADS", "2")))
    info = sf.info(str(audio))
    duration = info.frames / info.samplerate
    if duration <= 0 or duration > MAX_SECONDS or info.samplerate != 44100:
        raise ValueError("unsupported_duration")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    weights = get_default_weights_path()
    if not weights or not Path(weights).is_file():
        raise ValueError("missing_drum_weights")
    # Fail rather than silently use randomly initialized/mismatched model weights.
    load_pytorch_weights(create_frame_rnn_model(calculate_n_bins()), weights, strict=True)
    bp = None if lead_enabled else Model(Path(basic_pitch.__file__).parent / "saved_models" / "icassp_2022" / "nmp.onnx")
    separator = get_model("htdemucs_6s").to(device).eval()
    candidates = {name: {"source": name, "notes": [], "energy": 0.0} for name in ("vocals", "piano", "guitar", "other")}
    onsets = []
    lead_track = {"version":"lead-pulse-v1","events":[],"sections":[]}
    mappings = {35: "kick", 38: "snare", 42: "hat", 49: "hat"}
    node = os.environ.get("NODE_BINARY", "node")
    window = np.blackman(2048)
    for start in range(0, math.ceil(duration), SEGMENT_SECONDS):
        if not keep_running():
            raise ValueError("demand_expired")
        # Context protects attacks at segment boundaries; only core attacks publish.
        beginning = max(0, start - 1)
        end = min(duration, start + SEGMENT_SECONDS + 1)
        data, rate = sf.read(str(audio), start=beginning * 44100, stop=round(end * 44100),
                             dtype="float32", always_2d=True)
        segment = work / "segment.wav"
        sf.write(str(segment), data, rate)
        drum_file = work / "drums.mid"
        transcribe_to_midi(segment, drum_file, device=device)
        for instrument in pretty_midi.PrettyMIDI(str(drum_file)).instruments:
            for note in instrument.notes:
                time = beginning + note.start
                if note.pitch in mappings and start <= time < min(duration, start + SEGMENT_SECONDS):
                    onsets.append({"row": mappings[note.pitch], "time": time, "confidence": note.velocity / 127})
        waveform = torch.from_numpy(data.T.copy()).to(device)
        reference = waveform.mean(0)
        mean, std = reference.mean(), reference.std()
        if std.item() < 1e-7:
            continue
        with torch.no_grad():
            stems = apply_model(separator, ((waveform - mean) / std)[None], device=device,
                                shifts=0, split=True, overlap=.25, progress=False)[0]
            stems = (stems * std + mean).cpu().numpy()
        if melodic_observer is not None:
            # Offline experiments can inspect the same separated candidates;
            # the accepted production result and selector remain unchanged.
            melodic_observer({name: stems[index].T for index, name in enumerate(separator.sources)
                              if name in ("vocals", "piano", "guitar", "other")}, rate, beginning,
                             (start, min(duration, start + SEGMENT_SECONDS)))
        if lead_enabled:
            lead_sources = {name: stems[index].T for index, name in enumerate(separator.sources)}
            lead_python = os.environ.get("BEAT_LEAD_PYTHON")
            if lead_python:
                # Separate interpreter preserves the existing Torch/NumPy ABI.
                stem_archive, lead_output = work / "lead-stems.npz", work / "lead-result.json"
                np.savez(stem_archive, rate=rate, **lead_sources)
                command([lead_python, Path(__file__).with_name("run-lead-pulse.py"),
                         "--stems", stem_archive, "--output", lead_output])
                lead = json.loads(lead_output.read_text(encoding="utf-8"))
                stem_archive.unlink()
                lead_output.unlink()
            else:
                import importlib.util
                spec = importlib.util.spec_from_file_location("lead_pulse", Path(__file__).with_name("lead-pulse.py"))
                policy = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(policy)
                lead = policy.analyze_sources(lead_sources, rate)
            core_end=min(duration,start+SEGMENT_SECONDS)
            lead_track["events"].extend({**event,"start":event["start"]+beginning,
                "end":min(core_end,event["end"]+beginning)} for event in lead["events"] if start<=event["start"]+beginning<core_end)
            lead_track["sections"].extend({**section,"start":max(start,section["start"]+beginning),
                "end":min(core_end,section["end"]+beginning)} for section in lead["sections"]
                if section["end"]+beginning>start and section["start"]+beginning<core_end)
        for index, name in enumerate(separator.sources):
            if name not in candidates or lead_enabled:
                continue
            stem = stems[index].T
            candidates[name]["energy"] += float(np.mean(stem ** 2)) * (end - beginning)
            stem_file = work / f"{name}.wav"
            sf.write(str(stem_file), stem, rate)
            _, _, notes = predict(stem_file, bp, onset_threshold=.50, frame_threshold=.30, minimum_note_length=100)
            for a, b, pitch, amplitude, _ in notes:
                time = beginning + float(a)
                if start <= time < min(duration, start + SEGMENT_SECONDS):
                    candidates[name]["notes"].append({"start": time, "end": min(duration, beginning + float(b)),
                                                     "pitch": int(pitch), "amp": float(amplitude)})
            if len(candidates[name]["notes"]) > 200000:
                raise ValueError("too_many_notes")
        # Separation is already required for server lead analysis. Low pulses
        # use the measured bass candidate so piano/kick energy in the full mix
        # is not automatically a second Bass identity. Local DSP stays unchanged.
        mono = stems[separator.sources.index("bass")].mean(axis=0)
        spectra_file = work / "spectra.bin"
        with spectra_file.open("wb") as destination:
            for frame in range(math.ceil(len(mono) * 60 / rate)):
                finish = int(frame * rate / 60)
                samples = np.zeros(2048)
                left = max(0, finish - 2048)
                samples[2048 - (finish - left):] = mono[left:finish]
                spectrum = 20 * np.log10(np.maximum(np.abs(np.fft.rfft(samples * window)[:1024]) / 2048, 1e-12))
                destination.write(spectrum.astype("<f4").tobytes())
        bass_file = work / "bass.json"
        command([node, PROJECT / "scripts/extract-low-pulses.mjs", spectra_file, bass_file, beginning])
        onsets.extend(event for event in json.loads(bass_file.read_text())
                      if start <= event["time"] < min(duration, start + SEGMENT_SECONDS))
        if len(onsets) > 200000:
            raise ValueError("too_many_events")
    for value in candidates.values():
        value["energy"] /= duration
        value["notes"].sort(key=lambda note: note["start"])
    return {"asset": asset, "duration": duration, "onsets": onsets, "candidates": list(candidates.values()),
            **({"leadTrack":lead_track} if lead_enabled else {})}


def process(job, cache_directory):
    cache = Path(cache_directory).resolve()
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kora-audio-") as path:
        work = Path(path)
        audio = resolve_audio(job, work)
        result = analyze_audio(audio, job["asset"], work)
        candidates = work / "candidates.json"
        candidates.write_text(json.dumps(result), encoding="utf-8")
        analysis = work / "analysis.json"
        node = os.environ.get("NODE_BINARY", "node")
        command([node, PROJECT / "scripts/select-lead-source.mjs", candidates, analysis])
        selected = json.loads(analysis.read_text(encoding="utf-8"))
        print(json.dumps({"stage": "lead-selected", "source": selected["leadSource"] if selected["notes"] else None,
                          "candidates": [{"source": value["source"], "notes": len(value["notes"]), "energy": value["energy"]}
                                         for value in result["candidates"]]}, separators=(",", ":")), flush=True)
        staged = work / "cache"
        command([node, PROJECT / "scripts/import-beat-analysis.mjs", analysis, staged])
        key = job["cacheKey"]
        source = staged / key
        destination = cache / key
        if destination.exists():
            # Complete cached revisions remain immutable; failed partial output
            # is never created here because the directory publishes atomically.
            if (destination / "manifest.json").is_file():
                return
            raise ValueError("incomplete_cache_directory")
        # Stage on the destination filesystem before an atomic directory rename.
        stage = cache / f".{key}.tmp"
        if stage.exists():
            if stage.parent != cache:
                raise ValueError("invalid_stage")
            shutil.rmtree(stage)
        shutil.copytree(source, stage)
        os.replace(stage, destination)


if __name__ == "__main__":
    from service import parse_job
    record = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    process(parse_job(record["job"]), sys.argv[2])
