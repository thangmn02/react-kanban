"""Bounded learned drum identity, reusing the installed ADTOF weights."""
from __future__ import annotations

import numpy as np

FPS = 100
WINDOW_FRAMES = 100
STEP_FRAMES = 10
RIGHT_CONTEXT = 10
ROWS = {0: "kick", 1: "snare", 3: "hat", 4: "hat"}


class LearnedPercussion:
    """Scores are model activations, not calibrated instrument probabilities.

    Only a short trailing window is available at each inference call. The last
    100 ms is context, so the model never reads arbitrary future track audio.
    The source model is bidirectional: this is bounded-delay streaming, not a
    claim that its trained recurrent layers are inherently causal.
    """

    def __init__(self, weights=None, threads=2, onnx_path=None):
        from adtof_pytorch.audio import create_adtof_processor
        self.processor = create_adtof_processor()
        self.bins = self.processor.get_n_bins()
        self.session = None
        if onnx_path:
            import onnxruntime as ort
            options = ort.SessionOptions()
            options.intra_op_num_threads = threads
            self.session = ort.InferenceSession(str(onnx_path), options, providers=["CPUExecutionProvider"])
            return
        import torch
        from adtof_pytorch import get_default_weights_path
        from adtof_pytorch.model import create_frame_rnn_model, calculate_n_bins, load_pytorch_weights
        torch.set_num_threads(threads)
        self.model = load_pytorch_weights(create_frame_rnn_model(calculate_n_bins()),
                                          str(weights or get_default_weights_path()), strict=True).eval()

    def features(self, mono):
        """Exact installed frontend; centered STFT costs 23.22 ms of context."""
        return self.processor.apply_filterbank(self.processor.compute_stft(mono)).T[..., None]

    def activations(self, features):
        import torch
        length = len(features)
        result = np.zeros((length, 5), dtype=np.float32)
        # Padding is initial/terminal silence, not source separation or gain
        # normalization. Each block has exactly the same bounded live context.
        for end in range(STEP_FRAMES, length + RIGHT_CONTEXT + STEP_FRAMES, STEP_FRAMES):
            source_start = end - WINDOW_FRAMES
            block = np.zeros((WINDOW_FRAMES, self.bins, 1), dtype=np.float32)
            left, right = max(0, source_start), min(length, end)
            if right > left:
                block[left - source_start:right - source_start] = features[left:right]
            if self.session is not None:
                scores = self.session.run(["scores"], {"audio": block[None]})[0][0]
            else:
                with torch.inference_mode():
                    scores = self.model(torch.from_numpy(block[None])).numpy()[0]
            start, stop = end - RIGHT_CONTEXT - STEP_FRAMES, end - RIGHT_CONTEXT
            a, b = max(0, start), min(length, stop)
            if b > a:
                offset = WINDOW_FRAMES - RIGHT_CONTEXT - STEP_FRAMES + a - start
                result[a:b] = scores[offset:offset + b-a]
        return result


def percussion_events(activations, duration):
    """Explicit abstention: no accepted learned class means no semantic drum.

    Use the already-tested model's peak picker and per-class operating points.
    Tom remains out of Rows 1–3 rather than being renamed to another instrument.
    Independent classes may legitimately coincide. Hat/crash share one row.
    """
    from adtof_pytorch.post_processing import PeakPicker, LABELS_5, FRAME_RNN_THRESHOLDS
    picker = PeakPicker()
    peaks = picker.pick(activations, labels=LABELS_5)[0]
    accepted = {}
    events = []
    for index, row in ROWS.items():
        processor = picker.processors[index]
        avg = processor._moving_average(activations[:, index], 10, 1)
        for time in peaks[LABELS_5[index]]:
            if not 0 <= time < duration:
                continue
            frame = round(time * FPS)
            confidence = float(activations[frame, index])
            margin = float(activations[frame, index] - avg[frame] - FRAME_RNN_THRESHOLDS[index])
            event = {"type": row, "time": float(time), "confidence": confidence,
                     "classMargin": margin, "scores": activations[frame].tolist(),
                     "origin": "learned-percussion", "semantic": True}
            key = (row, frame)
            if key not in accepted or accepted[key]["confidence"] < confidence:
                accepted[key] = event
    events.extend(accepted.values())
    events.sort(key=lambda event: (event["time"], event["type"]))
    return events


def frame_decisions(activations, events):
    """Keep non-percussion/abstain explicit without inventing its probability."""
    by_frame = {}
    for event in events:
        by_frame.setdefault(round(event["time"] * FPS), []).append(event["type"])
    return [{"time": frame / FPS, "outcome": by_frame.get(frame, ["non-percussion/abstain"]),
             "scores": scores.tolist(), "semantic": frame in by_frame}
            for frame, scores in enumerate(activations)]
