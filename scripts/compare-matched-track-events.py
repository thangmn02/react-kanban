"""Same-PCM event accounting. Detector disagreement is never an accuracy label."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')


def class_summary(events):
    out = {}
    for instrument in ['kick', 'snare', 'hat', 'cymbal', 'tom']:
        chosen = sorted((e for e in events if e['instrument'] == instrument), key=lambda e: e['time'])
        times = np.asarray([e['time'] for e in chosen])
        gaps = np.diff(times)
        dense = {i for i, t in enumerate(times) if (i and t-times[i-1] <= .125+1e-8)
                 or (i+1 < len(times) and times[i+1]-t <= .125+1e-8)}
        out[instrument] = {'count': len(chosen),
            'meanSpacingMs': float(np.mean(gaps)*1000) if len(gaps) else None,
            'medianSpacingMs': float(np.median(gaps)*1000) if len(gaps) else None,
            'rapidEvents125ms': len(dense),
            'spacingBinsMs': {str(ms): int(np.count_nonzero(abs(gaps-ms/1000) <= .005+1e-8))
                              for ms in [20, 30, 50, 80, 125, 200]},
            'overlappingOtherClass20ms': sum(any(other['instrument'] != instrument
                and abs(other['time']-event['time']) <= .02+1e-8 for other in events) for event in chosen)}
    return out


def associate(left, right, matcher):
    result = {}
    for instrument in ['kick', 'snare', 'hat', 'cymbal']:
        a = sorted((e for e in left if e['instrument'] == instrument), key=lambda e: e['time'])
        b = sorted((e for e in right if e['instrument'] == instrument), key=lambda e: e['time'])
        pairs, tolerances = matcher([e['time'] for e in a], [e['time'] for e in b], .05)
        ia = {p['referenceIndex'] for p in pairs}
        ib = {p['predictionIndex'] for p in pairs}
        errors = [(b[p['predictionIndex']]['time']-a[p['referenceIndex']]['time'])*1000 for p in pairs]
        result[instrument] = {'shared': len(pairs), 'leftOnly': [e for i, e in enumerate(a) if i not in ia],
            'rightOnly': [e for i, e in enumerate(b) if i not in ib],
            'medianSignedDifferenceMs': float(np.median(errors)) if errors else None,
            'absoluteDifferenceP95Ms': float(np.percentile(np.abs(errors), 95)) if errors else None,
            'pairs': [{'leftId': a[p['referenceIndex']]['id'], 'rightId': b[p['predictionIndex']]['id'],
                       'differenceMs': (b[p['predictionIndex']]['time']-a[p['referenceIndex']]['time'])*1000,
                       'toleranceMs': tolerances[p['referenceIndex']]*1000} for p in pairs]}
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--start', type=float, default=20)
    parser.add_argument('--end', type=float, default=50)
    parser.add_argument('--output', default='scratch/matched-track-quality-gap')
    parser.add_argument('--lab-base', default='http://127.0.0.1:5173')
    args = parser.parse_args()
    assert len(args.source_sha) == 64 and all(c in '0123456789abcdef' for c in args.source_sha)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    assert not (out/'offline-events.json').exists(), 'Preserve the previous comparison; use a new output folder'
    folder = Path('scratch/acoustic-visual-lab/full-songs')/args.source_sha
    source = read(folder/'source.json')
    catalog = read(folder.parent/'songs.json')['sources'][args.source_sha]
    original = Path(catalog['source'])
    downloads = Path.home()/'Downloads'/catalog['filename']
    assert sha(original) == sha(downloads) == args.source_sha == source['originalSha256']
    assert sha(folder/'canonical.wav') == source['canonicalWavSha256']
    pcm, sr = sf.read(folder/'canonical.wav', dtype='float32', always_2d=True)
    assert sr == source['sampleRate'] == 44100 and pcm.shape[1] == source['channels'] == 2
    assert hashlib.sha256(pcm.astype('<f4').tobytes()).hexdigest() == source['decodedPcmSha256']
    assert 0 <= args.start < args.end <= source['duration']
    del pcm
    preparation = module('matched_preparation', 'scripts/prepare-full-song.py')
    scoring = module('matched_associations', 'scripts/score-beat-v2-round.py')
    hybrid = module('matched_hybrid', 'scripts/hat-recovery-core.py')
    records, bindings = {}, {}
    for label in ['A', 'B']:
        record = read(folder/(label+'.json'))
        assert preparation.valid_cache(folder/(label+'.json'), folder/record['rawFile'], record['cacheKey'],
                                       args.source_sha, source['decodedPcmSha256'])
        assert sha(folder/'models'/record['cacheKey']/'record.json') == sha(folder/(label+'.json'))
        records[label] = record
        bindings[label] = {'recordSha256': sha(folder/(label+'.json')), 'rawSha256': record['rawSha256'],
                           'cacheKey': record['cacheKey'], 'contract': record['contract']['identities'][label]}
    assert args.lab_base in ['http://127.0.0.1:1420', 'http://127.0.0.1:5173']
    with urllib.request.urlopen(args.lab_base+'/lab/full/clip/'+args.source_sha, timeout=45) as response:
        clip = json.load(response)
    expected_h = hybrid.hypothetical_hybrid(records['A']['events'], records['B']['events'])
    for actual, expected in zip(clip['predictions']['H'], expected_h):
        assert all(actual[k] == v for k, v in expected.items())
    assert len(clip['predictions']['H']) == len(expected_h) and clip['hybrid']['state'] == 'READY'
    raw = read(folder/records['A']['rawFile'])
    packet = {'variants': ['L0', 'L1-gap0'], 'items': [{'id': args.source_sha,
              'frames': [{'audioTime': t, 'scores': s} for t, s in zip(raw['times'], raw['scores'])]}]}
    result = subprocess.run(['node', 'scripts/replay-early-percussion-decisions.mjs'],
                            input=json.dumps(packet).encode(), capture_output=True, check=True)
    replay = json.loads(result.stdout)['runs'][0]
    original_keys = sorted((e['instrument'], round(e['time'], 8)) for e in records['A']['events'])
    assert original_keys == sorted((e['instrument'], round(e['time'], 8)) for e in replay['variants']['L0']['events'])
    tracks = {'L0': records['A']['events'], 'L1': [], 'H0': clip['predictions']['H']}
    origin = {(e['instrument'], round(e['time'], 8)): e['id'] for e in tracks['L0']}
    for e in replay['variants']['L1-gap0']['events']:
        tracks['L1'].append({**e, 'id': f'matched:{args.source_sha}:L1:{e["classIndex"]}:{e["time"]:.8f}',
                             'originPredictionId': origin.get((e['instrument'], round(e['time'], 8))),
                             'sourceTime': e['time'], 'modelSha256': bindings['A']['contract']['contract']['modelSha256']})
    comparisons = {}
    for name, start, end in [('full', 0, source['duration']), ('passage', args.start, args.end)]:
        selected = {mode: [e for e in events if start <= e['time'] < end] for mode, events in tracks.items()}
        comparisons[name] = {'start': start, 'end': end, 'classes': {k: class_summary(v) for k, v in selected.items()},
            'associations': {a+'→'+b: associate(selected[a], selected[b], scoring.match)
                             for a, b in [('L0', 'L1'), ('L0', 'H0'), ('L1', 'H0')]},
            'hatRowCounts': {mode: sum(e['instrument'] in ['hat', 'cymbal'] for e in events)
                             for mode, events in selected.items()}}
        display = {mode: [{**e, 'originInstrument': e['instrument'],
                    'instrument': 'hat' if e['instrument'] in ['hat', 'cymbal'] else e['instrument']}
                   for e in events] for mode, events in selected.items()}
        comparisons[name]['displayRowAssociations'] = {
            a+'→'+b: associate(display[a], display[b], scoring.match)
            for a, b in [('L0', 'L1'), ('L0', 'H0'), ('L1', 'H0')]}
    review = []
    for direction, side, mode in [('L1→H0', 'leftOnly', 'L1'), ('L1→H0', 'rightOnly', 'H0')]:
        for event in comparisons['passage']['displayRowAssociations'][direction]['hat'][side]:
            t = event['time']
            review.append({'id': event['id'], 'sourceTime': t, 'mode': mode,
                'associationView': 'display-row', 'originInstrument': event.get('originInstrument', event['instrument']),
                'reason': 'unmatched detector proposal, not an acoustic error label',
                'nearAdtofSnare50ms': [e['id'] for e in tracks['L1'] if e['instrument'] == 'snare' and abs(e['time']-t) <= .05],
                'reviewStart': max(args.start, t-.35), 'reviewEnd': min(args.end, t+.35),
                'confidence': 'unverified', 'onsetUncertaintyMs': None, 'ambiguous': True})
    identity = {'source': source, 'downloadsFile': str(downloads), 'retainedOriginal': str(original),
        'labSourceId': args.source_sha, 'bindings': bindings, 'hybridEventTrack': clip['hybrid'],
        'labBase': args.lab_base,
        'userConfirmedRecording': True, 'userRequestedStartSeconds': args.start,
        'analysisPassageEndSeconds': args.end, 'passageEndProvenance': 'bounded 30-second engineering window; not a user-supplied end',
        'youTubePcmEquivalence': 'UNVERIFIED', 'referenceStatus': 'provisional-human-reference',
        'officialSongMetricsAllowed': False, 'neuralInferenceRun': False,
        'filesBefore': {str(p): sha(p) for p in [folder/'A.json', folder/'B.json', folder/'canonical.wav',
                        folder/records['A']['rawFile'], folder/records['B']['rawFile']]}}
    write(out/'source-identity.json', identity)
    write(out/'offline-events.json', {'tracks': tracks, 'comparisons': comparisons, 'reviewQueue': review,
        'l0L1ReleaseComparison': replay['comparison']['L1-gap0'],
        'associationProtocol': 'Directed maximum-cardinality, minimum-error matching; 50ms cap and quarter nearest left-event spacing. Associations are not acoustic P/R/F1.',
        'coverage': clip['coverage'], 'neuralInferenceRun': False, 'officialSongMetricsAllowed': False})
    print(json.dumps({'source': args.source_sha, 'duration': source['duration'],
        'full': comparisons['full']['classes'], 'passage': comparisons['passage']['classes'],
        'reviewQueue': len(review)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
