"""Basic Pitch (Apache-2.0, nmp.onnx 2c3c1d14…) note front end on separated stems. Writes tracks_bp.json in
the same shape as track-stems.mjs: per stem, frames [time, midi|null, activation] and note-onset events.
Offline full-context inference (Basic Pitch's own 2 s windows, 30-frame overlap)."""
import sys, json, os, glob
import numpy as np, soundfile as sf, librosa, onnxruntime as ort

MODEL = 'scratch/live-lead-261031/bp-wheel/x/basic_pitch/saved_models/icassp_2022/nmp.onnx'
SR, HOP, N = 22050, 256, 43844
FPS = SR / HOP
session = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])


def infer(audio):
    olap = 30 * HOP; hop = N - olap
    padded = np.concatenate([np.zeros(olap // 2, np.float32), audio])
    wins = np.stack([np.pad(padded[i:i + N], (0, max(0, N - len(padded[i:i + N])))) for i in range(0, len(padded), hop)])
    note, onset, contour = session.run(['StatefulPartitionedCall:1', 'StatefulPartitionedCall:2', 'StatefulPartitionedCall:0'], {'serving_default_input_2:0': wins[..., None].astype(np.float32)})
    trim = lambda x: np.concatenate([w[15:-15] for w in x])[:int(len(audio) / HOP) + 1]
    return trim(note), trim(onset)


def track(path, note_threshold=.3, onset_threshold=.5, min_gap=.05):
    y, _ = librosa.load(path, sr=SR, mono=True)
    peak = np.max(np.abs(y)) or 1; y = (y * (.5 / peak)).astype(np.float32)
    note, onset = infer(y)
    frames, events, last = [], [], -1e9
    for i in range(len(note)):
        t = i / FPS; k = int(np.argmax(note[i])); a = float(note[i, k])
        # Monophonic lead line: the strongest active note; onsets are onset-head peaks at that note (±1 semitone).
        frames.append([round(t, 4), 21 + k if a >= note_threshold else None, round(a, 3)])
        lo, hi = max(0, k - 1), min(88, k + 2); o = onset[i, lo:hi].max()
        prev = onset[i - 1, lo:hi].max() if i else 0; nxt = onset[i + 1, lo:hi].max() if i + 1 < len(onset) else 0
        if a >= note_threshold * .8 and o >= onset_threshold and o >= prev and o >= nxt and t - last >= min_gap:
            events.append({'t': round(t, 4), 'pitch': 21 + k, 'kind': 'note'}); last = t
    return {'frames': frames, 'events': events}


if __name__ == '__main__':
    for d in sys.argv[1:]:
        out = {s: track(os.path.join(d, s + '.wav')) for s in ('mix', 'vocals', 'other')}
        old = json.load(open(os.path.join(d, 'tracks.json'))); out['mixC6'] = old['mixC6']
        json.dump(out, open(os.path.join(d, 'tracks_bp.json'), 'w'))
        print(d, {s: len(out[s]['events']) for s in ('mix', 'vocals', 'other')})
