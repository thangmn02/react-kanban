"""Private monophonic F0 experiment. No tracker, EventTrack or production imports."""
from dataclasses import asdict, dataclass
import numpy as np
from scipy.ndimage import median_filter


@dataclass(frozen=True)
class Settings:
    sample_rate: int = 22050
    hop: int = 220
    frame_length: int = 2048
    minimum_probability: float = .1
    rms_floor: float = .0001
    stable_seconds: float = .06
    minimum_note_seconds: float = .08
    pitch_change: float = .7
    reattack_spacing: float = .12
    envelope_valley: float = .5


def runs(mask):
    """Half-open runs without joining even a single missing frame."""
    padded = np.r_[False, np.asarray(mask, dtype=bool), False].astype(int)
    return list(zip(np.flatnonzero(np.diff(padded) == 1), np.flatnonzero(np.diff(padded) == -1)))


def segment(times, f0, flags, probabilities, rms, duration, settings=Settings()):
    times, f0, probabilities, rms = [np.asarray(x, dtype=float) for x in (times, f0, probabilities, rms)]
    flags = np.asarray(flags, dtype=bool)
    if not all(len(x) == len(times) for x in (f0, flags, probabilities, rms)):
        raise ValueError("Frame arrays must have identical lengths")
    if duration <= 0 or np.any(np.diff(times) <= 0) or np.any(times < 0):
        raise ValueError("Invalid excerpt clock")
    dt = settings.hop / settings.sample_rate
    valid = flags & np.isfinite(f0) & (f0 > 0) & (probabilities >= settings.minimum_probability) & (rms >= settings.rms_floor) & (times < duration)
    pitch = np.full(len(times), np.nan)
    pitch[valid] = 69 + 12 * np.log2(f0[valid] / 440)
    stable = max(1, int(np.ceil(settings.stable_seconds / dt)))
    notes, phrases = [], []
    for start, end in runs(valid):
        # Never median-filter across a rest or interpolate an unvoiced pitch.
        smooth = median_filter(pitch[start:end], size=5, mode="nearest")
        phrases.append({"start": float(times[start]), "end": min(duration, float(times[end - 1] + dt))})
        boundaries = [(start, "voiced-start")]
        anchor = float(np.median(smooth[:stable]))
        for index in range(start + stable, end - stable + 1):
            if index - boundaries[-1][0] < stable:
                continue
            future = smooth[index-start:index-start+stable]
            center = float(np.median(future))
            coherent = float(np.max(np.abs(future - center))) < .45
            change = coherent and abs(center - anchor) >= settings.pitch_change
            # Same-pitch attacks require a real valley/recovery, not pitch vibrato.
            lookback = max(start, index - int(.15 / dt))
            reference = float(np.median(rms[lookback:index]))
            valley = float(np.min(rms[max(start, index-stable):index]))
            recovered = rms[index] > reference * .8 and valley < reference * settings.envelope_valley
            crossing = index == start or rms[index-1] <= reference * .8
            reattack = coherent and abs(center-anchor) < settings.pitch_change and recovered and crossing and times[index]-times[boundaries[-1][0]] >= settings.reattack_spacing
            if change or reattack:
                boundaries.append((index, "stable-pitch-change" if change else "envelope-reattack"))
                anchor = center
        for number, (a, reason) in enumerate(boundaries):
            b = boundaries[number+1][0] if number+1 < len(boundaries) else end
            finish = min(duration, float(times[b-1] + dt))
            if finish - times[a] < settings.minimum_note_seconds:
                continue
            notes.append({"start": float(times[a]), "end": finish, "pitch": float(np.median(smooth[a-start:b-start])),
                          "amp": float(np.median(probabilities[a:b])), "origin": reason})
    return {"notes": notes, "voicedRuns": phrases, "settings": asdict(settings),
            "frames": [{"time": float(t), "pitch": float(p) if ok else None, "voiced": bool(ok), "probability": float(q)}
                       for t, p, ok, q in zip(times, pitch, valid, probabilities)]}
