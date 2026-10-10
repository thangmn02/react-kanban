"""Experimental melodic activity; spectral novelty does not identify a main lead."""
from dataclasses import dataclass
import hashlib
import math
from typing import Protocol

import numpy as np

MELODIC_SOURCES = ("vocals", "piano", "guitar", "other")


@dataclass(frozen=True)
class MelodyBusConfig:
    low_hz: float = 150
    high_hz: float = 8000
    fft_size: int = 2048
    hop_seconds: float = .01
    history_seconds: float = 1.5
    threshold_mad: float = 3
    novelty_floor: float = .035
    min_spacing: float = .24
    sustain_similarity: float = .97
    retrigger_gain: float = .15
    silence_rms: float = 1e-5
    spectral_floor_ratio: float = .001
    max_normalization_gain: float = 4
    confidence_ceiling: float = .55

    def validate(self, rate):
        numbers = [getattr(self, name) for name in self.__dataclass_fields__]
        if not all(isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) for n in numbers):
            raise ValueError("invalid_melody_bus_config")
        if not 8000 <= rate <= 96000 or not 0 <= self.low_hz < self.high_hz <= rate / 2:
            raise ValueError("invalid_melody_bus_band")
        if self.fft_size not in (512, 1024, 2048, 4096) or not .005 <= self.hop_seconds <= .05:
            raise ValueError("invalid_melody_bus_resolution")
        if not .25 <= self.history_seconds <= 10 or not .1 <= self.min_spacing <= 2:
            raise ValueError("invalid_melody_bus_spacing")
        if not .5 <= self.threshold_mad <= 10 or not 0 < self.novelty_floor <= 1:
            raise ValueError("invalid_melody_bus_threshold")
        if not 0 <= self.sustain_similarity <= 1 or not 0 <= self.retrigger_gain <= 2:
            raise ValueError("invalid_melody_bus_sustain")
        if not 0 < self.silence_rms <= .01 or not 1 <= self.max_normalization_gain <= 16:
            raise ValueError("invalid_melody_bus_normalization")
        if not 0 < self.spectral_floor_ratio <= .1:
            raise ValueError("invalid_melody_bus_spectral_floor")
        if not 0 < self.confidence_ceiling <= 1:
            raise ValueError("invalid_melody_bus_confidence")


class MelodyBusDetector(Protocol):
    def detect(self, stems: dict, rate: int, offset: float = 0, output_range=None) -> list[dict]: ...


class SpectralMelodyBusDetector:
    def __init__(self, config=None):
        self.config = config or MelodyBusConfig()

    def detect(self, stems, rate, offset=0, output_range=None):
        config = self.config
        config.validate(rate)
        if not isinstance(stems, dict) or not math.isfinite(offset) or offset < 0:
            raise ValueError("invalid_melody_bus_input")
        sources, length = [], None
        for name in MELODIC_SOURCES:
            if name not in stems:
                continue
            data = np.asarray(stems[name], dtype=np.float32)
            if data.ndim == 2 and data.shape[1] in (1, 2):
                data = data.mean(axis=1)
            if data.ndim != 1 or not len(data) or len(data) > rate * 310 or not np.isfinite(data).all():
                raise ValueError("invalid_melody_bus_stem")
            if length is not None and length != len(data):
                raise ValueError("misaligned_melody_bus_stems")
            length = len(data)
            rms = float(np.sqrt(np.mean(data.astype(np.float64) ** 2)))
            if rms > config.silence_rms:
                sources.append((data, rms))
        if not sources:
            return []
        duration = length / rate
        beginning, end = output_range or (offset, offset + duration)
        if not all(math.isfinite(n) for n in (beginning, end)) or beginning < offset or end > offset + duration + 1e-6 or end <= beginning:
            raise ValueError("invalid_melody_bus_range")
        target = float(np.median([rms for _, rms in sources]))
        bus = sum(data * min(config.max_normalization_gain, target / rms) for data, rms in sources) / len(sources)
        hop = max(1, round(rate * config.hop_seconds))
        padded = np.pad(bus, config.fft_size // 2)
        frames = np.lib.stride_tricks.sliding_window_view(padded, config.fft_size)[::hop]
        frequencies = np.fft.rfftfreq(config.fft_size, 1 / rate)
        band = (frequencies >= config.low_hz) & (frequencies <= config.high_hz)
        if not band.any():
            raise ValueError("empty_melody_bus_band")
        spectra = []
        window = np.hanning(config.fft_size)
        for start in range(0, len(frames), 256):
            spectra.append(np.abs(np.fft.rfft(frames[start:start + 256] * window))[:, band].astype(np.float32))
        magnitude = np.concatenate(spectra)
        # Per-bin normalization adapts timbre without assuming a fixed lead band
        # or that the sharpest/loudest source owns the melody.
        spectral_floor = target * config.fft_size * config.spectral_floor_ratio
        baseline = np.maximum(np.median(magnitude, axis=0), spectral_floor)
        compressed = np.log1p(magnitude / baseline)
        novelty = np.mean(np.maximum(0, np.diff(compressed, axis=0, prepend=compressed[:1])), axis=1)
        energy = np.linalg.norm(magnitude, axis=1)
        history = max(3, round(config.history_seconds * rate / hop))
        sustain_lookback = max(1, round(.05 * rate / hop))
        silence_energy = config.silence_rms * config.fft_size
        last = -math.inf
        events = []
        for index in range(1, len(novelty) - 1):
            time = offset + index * hop / rate
            if not beginning <= time < end or time - last < config.min_spacing:
                continue
            if novelty[index] <= novelty[index - 1] or novelty[index] < novelty[index + 1]:
                continue
            recent = novelty[max(0, index - history):index]
            center = float(np.median(recent))
            spread = float(np.median(np.abs(recent - center)))
            threshold = max(config.novelty_floor, center + config.threshold_mad * 1.4826 * spread)
            if novelty[index] <= threshold or energy[index] <= silence_energy:
                continue
            lookback = max(0, index - sustain_lookback)
            denominator = energy[index] * energy[lookback]
            similarity = float(np.dot(magnitude[index], magnitude[lookback]) / denominator) if denominator else 0
            gain = (energy[index] - energy[lookback]) / max(energy[lookback], spectral_floor)
            if similarity >= config.sustain_similarity and gain < config.retrigger_gain:
                continue
            strength = float(novelty[index] / (novelty[index] + threshold))
            if events:
                previous = events[-1]
                previous["duration"] = min(previous["duration"], time - previous["playbackTime"])
            events.append({
                "eventId": hashlib.sha256(f"melody-bus-experiment-v1:{time:.9f}".encode()).hexdigest(),
                "type": "melody",
                "playbackTime": time,
                "duration": min(.12, end - time),
                "confidence": min(config.confidence_ceiling, strength),
                "source": "server-cache",
            })
            last = time
        return events


class ExperimentalMelodyFallback:
    """Opt-in candidate substitution, never a default production lead decision."""
    def __init__(self, detector: MelodyBusDetector, enabled=False, confidence_threshold=.6):
        if not isinstance(enabled, bool):
            raise ValueError("invalid_melody_bus_opt_in")
        if not math.isfinite(confidence_threshold) or not 0 <= confidence_threshold <= 1:
            raise ValueError("invalid_lead_confidence_threshold")
        self.detector = detector
        self.enabled = enabled
        self.confidence_threshold = confidence_threshold

    def choose(self, accepted_events, decision, stems, rate, **timing):
        confidence = decision.get("confidence")
        if not isinstance(confidence, (float, int)) or isinstance(confidence, bool) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("invalid_lead_confidence")
        if not self.enabled or confidence >= self.confidence_threshold:
            return {"path": "accepted-lead", "events": accepted_events}
        candidates = self.detector.detect(stems, rate, **timing)
        # No useful novelty must never erase an existing accepted lead.
        if candidates:
            return {"path": "experimental-melody-bus", "events": candidates, "evidence": "spectral-activity-only"}
        return {"path": "accepted-lead", "events": accepted_events, "evidence": "spectral-activity-only"}
