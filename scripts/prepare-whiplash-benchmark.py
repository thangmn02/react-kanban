"""Prepare private audio-only review fixtures; never infer reference drum labels."""
import argparse
import array
import hashlib
import json
import re
import subprocess
import sys
import wave
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def decode(ffmpeg, path):
    result = subprocess.run(
        [ffmpeg, '-nostdin', '-hide_banner', '-i', str(path), '-vn', '-ar',
         '44100', '-ac', '2', '-f', 'f32le', 'pipe:1'], capture_output=True, check=True)
    text = result.stderr.decode('utf-8', errors='replace')
    rate = re.search(r'Audio:.*?, (\d+) Hz, ([^,\r\n]+)', text)
    return result.stdout, {'sourceSampleRate': int(rate[1]) if rate else None,
                           'sourceChannelLayout': rate[2] if rate else None,
                           'decodeLog': text}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads', type=Path, required=True)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--output', type=Path, default=Path('scratch/whiplash-benchmark'))
    args = parser.parse_args()
    output = args.output.resolve()
    # Generated copyrighted audio must remain in the repository's ignored scratch.
    scratch = Path(__file__).resolve().parents[1] / 'scratch'
    if not output.is_relative_to(scratch) or output == scratch:
        parser.error('--output must be a child of the repository scratch directory')
    if output.exists():
        parser.error('Output already exists; choose a new private directory to preserve review evidence')
    output.mkdir(parents=True)
    files = sorted(p for p in args.downloads.iterdir() if p.suffix.lower() in {'.mp3', '.mp4', '.wav', '.flac'})
    specs = [
        ('whiplash', 'Whiplash.mp3', 0, 'challenge'),
        ('mono', 'MONO - Em Là', 0, 'reported absent percussion; confirm all rows'),
        ('levels', 'Avicii - Levels', 45, 'EDM'),
        ('trap', 'Lil Uzi Vert', 45, 'hip-hop/trap'),
        ('rock', 'Muse - Hysteria', 45, 'rock'),
        ('pop', 'Coldplay - Yellow', 45, 'pop'),
        ('piano', 'Erik Satie', 0, 'candidate drum-free piano; confirm'),
        ('weightless', 'Marconi Union - Weightless (Official Video).mp3', 0, 'previously problematic control'),
        ('bich-phuong', 'Những Lời Hứa Bỏ Quên', 0, 'previously problematic recording; confirm artist and source'),
    ]
    manifest = {'version': 1, 'referenceStatus': 'awaiting-independent-review',
                'recordingIdentity': 'provisional; local file has no artist/album tags',
                'soundtrackReference': 'https://www.youtube.com/watch?v=-jAtHf9RA4w',
                'decode': {'sampleRate': 44100, 'channels': 2, 'format': 'little-endian float32',
                           'ffmpegVersion': subprocess.check_output([args.ffmpeg, '-version']).decode().splitlines()[0]},
                'files': [], 'excerpts': [], 'missing': [],
                'selectionPolicy': 'Whiplash fixed exploratory windows, not verified musical coverage; control offsets fixed before inference. No detector-based selection.'}
    for key, prefix, offset, role in specs:
        matches = [p for p in files if p.name.startswith(prefix)]
        if len(matches) != 1:
            manifest['missing'].append({'id': key, 'matches': [p.name for p in matches]})
            continue
        path = matches[0]
        pcm, info = decode(args.ffmpeg, path)
        duration = len(pcm) / (44100 * 2 * 4)
        (output / f'{key}-decode.txt').write_text(info.pop('decodeLog'), encoding='utf-8')
        source_hash = digest(path.read_bytes())
        manifest['files'].append({'id': key, 'filename': path.name, 'sha256': source_hash,
                                  'bytes': path.stat().st_size, 'decodedDuration': duration,
                                  'decodedPcmSha256': digest(pcm), **info})
        windows = [('W1', 8, 'ensemble candidate'), ('W2', 60, 'dense percussion candidate'),
                   ('W3', 95, 'meter/transition candidate')] if key == 'whiplash' else [(key, offset, role)]
        for name, start, purpose in windows:
            length = 13 if key in {'mono', 'bich-phuong'} else 12
            end = start + length
            if end > duration:
                raise ValueError(f'{name} exceeds decoded audio duration')
            excerpt = pcm[start * 44100 * 8:end * 44100 * 8]
            (output / f'{name.lower()}.f32').write_bytes(excerpt)
            samples = array.array('f', excerpt)
            if sys.byteorder != 'little':
                samples.byteswap()
            wav = array.array('h', (max(-32768, min(32767, round(v * 32767))) for v in samples))
            if sys.byteorder != 'little':
                wav.byteswap()
            with wave.open(str(output / f'{name.lower()}.wav'), 'wb') as audio:
                audio.setnchannels(2)
                audio.setsampwidth(2)
                audio.setframerate(44100)
                audio.writeframes(wav.tobytes())
            stride = 882  # 10 ms stereo peaks for navigation only, not instrument labels.
            peaks = [round(max(abs(x) for x in samples[i:i + stride]), 5)
                     for i in range(0, len(samples), stride)]
            manifest['excerpts'].append({'input': name, 'source': key, 'sourceSha256': source_hash,
                'sourceStart': start, 'sourceEnd': end, 'duration': length, 'role': purpose,
                'coverageVerified': False, 'pcmSha256': digest(excerpt),
                'reviewWavSha256': digest((output / f'{name.lower()}.wav').read_bytes()),
                'file': f'{name.lower()}.wav', 'pcm': f'{name.lower()}.f32', 'peaks': peaks})
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    (output / 'manifest.json').write_text(encoded, encoding='utf-8')
    manifest_hash = digest((output / 'manifest.json').read_bytes())
    (output / 'manifest.sha256').write_text(manifest_hash + '\n', encoding='ascii')
    template = Path(__file__).with_name('whiplash-annotation-review.html').read_text(encoding='utf-8')
    # Inline metadata makes file:// review work without a server or network requests.
    inline = json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c')
    (output / 'review.html').write_text(template.replace('__BENCHMARK_MANIFEST__', inline), encoding='utf-8')
    print(json.dumps({'output': str(output), 'files': len(manifest['files']),
                      'excerpts': len(manifest['excerpts']), 'missing': manifest['missing'],
                      'manifestSha256': manifest_hash}))


if __name__ == '__main__':
    main()
