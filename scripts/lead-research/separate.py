"""Spleeter 4-stem separation with the exact pinned ONNX weights Kora shipped in Companion 0.3.12.

Spleeter's own front end: 44.1 kHz stereo, STFT 4096 / hop 1024 (Hann), the first 1024 bins, 512-frame splits,
soft ratio masks from the four estimates applied to the mixture STFT, inverse STFT with the mixture phase.
Writes mono 44.1 kHz float WAVs for `vocals` and `other` (and the mixture) into the output folder.
"""
import sys, json, time, os, hashlib
import numpy as np, soundfile as sf, librosa, onnxruntime as ort

MODELS = os.path.join(os.path.dirname(__file__), 'models')
STEMS = ['vocals', 'drums', 'bass', 'other']
N_FFT, HOP, BINS, SPLIT = 4096, 1024, 1024, 512


def separate(path, out_dir, start=None, duration=None):
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.perf_counter()
    y, _ = librosa.load(path, sr=44100, mono=False, offset=start or 0.0, duration=duration)
    if y.ndim == 1: y = np.stack([y, y])
    stft = np.stack([librosa.stft(ch, n_fft=N_FFT, hop_length=HOP, window='hann', center=True) for ch in y])  # (2, F, T)
    mag = np.abs(stft[:, :BINS, :]).transpose(0, 2, 1)  # (2, T, BINS)
    frames = mag.shape[1]; pad = (-frames) % SPLIT
    x = np.pad(mag, ((0, 0), (0, pad), (0, 0))).reshape(2, -1, SPLIT, BINS).astype(np.float32)
    estimates = {}
    for stem in STEMS:
        session = ort.InferenceSession(os.path.join(MODELS, stem + '.onnx'), providers=['CPUExecutionProvider'])
        estimates[stem] = session.run(['y'], {'x': x})[0].reshape(2, -1, BINS)[:, :frames, :]
    power = sum(e ** 2 for e in estimates.values()) + 1e-10
    outputs = {}
    for stem in ('vocals', 'other'):
        mask = (estimates[stem] ** 2 + 1e-10 / len(STEMS)) / power  # (2, T, BINS)
        masked = np.zeros_like(stft)
        masked[:, :BINS, :] = stft[:, :BINS, :] * mask.transpose(0, 2, 1)
        wave = np.mean([librosa.istft(masked[c], hop_length=HOP, window='hann', center=True, length=y.shape[1]) for c in range(2)], axis=0)
        sf.write(os.path.join(out_dir, stem + '.wav'), wave.astype(np.float32), 44100, subtype='FLOAT')
        outputs[stem] = float(np.sqrt(np.mean(wave ** 2)))
    sf.write(os.path.join(out_dir, 'mix.wav'), y.mean(axis=0).astype(np.float32), 44100, subtype='FLOAT')
    seconds = y.shape[1] / 44100
    return {'seconds': round(seconds, 2), 'separationSeconds': round(time.perf_counter() - t0, 2),
            'realtimeFactor': round((time.perf_counter() - t0) / seconds, 3), 'stemRms': outputs}


if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    start = float(sys.argv[3]) if len(sys.argv) > 3 else None
    duration = float(sys.argv[4]) if len(sys.argv) > 4 else None
    print(json.dumps(separate(path, out, start, duration)))
