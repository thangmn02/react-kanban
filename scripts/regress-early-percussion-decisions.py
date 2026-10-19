"""Supplement locked L1 results with exact controls and unscored song regressions."""
import importlib.util
import json
import subprocess
from collections import Counter
from pathlib import Path


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


d2 = module('decision_comparison', 'scripts/compare-early-percussion-decisions.py')
preparation = module('full_song_preparation', 'scripts/prepare-full-song.py')
OUT = d2.OUT
selection = d2.evidence.read(OUT / 'selection.json')
assert selection['admission']['scripts'] == {p: d2.evidence.sha(p) for p in d2.SCRIPTS}
names = ['L0', selection['selected']]
confirmation = d2.evidence.read(OUT / 'confirmation.json')
manifest = d2.evidence.read(d2.ROOT / 'corpus-manifest.json')
segments = []
for item in manifest['items']:
    if item['partition'] != 'locked-holdout' or not item.get('segments'):
        continue
    run = next(r for r in confirmation['runs'] if r['id'] == item['id'])
    for segment in item['segments']:
        excerpt = {**item, 'analysisStart': segment['start'], 'analysisEnd': segment['end']}
        for name in names:
            view = d2.scoring.score(excerpt, {'lane': name, 'events': run['variants'][name]['events']})
            segments.append({**view, 'intervalMs': segment['intervalMs']})
segment_regressions = []
for view in segments:
    if view['lane'] == 'L0':
        continue
    base = next(v for v in segments if v['lane'] == 'L0' and v['id'] == view['id'] and v['intervalMs'] == view['intervalMs'])
    for cls in ['kick', 'snare', 'hat']:
        if view['classes'][cls]['tp'] < base['classes'][cls]['tp']:
            segment_regressions.append(f'{view["id"]}/{view["intervalMs"]}/{cls} lost matches')

store = Path('scratch/acoustic-visual-lab/full-songs')
_, current = preparation.contracts()
cases = [
    ('nujabes-full', '349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f', 0, None),
    ('rangem-hat-negative', 'edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a', 26, 44),
    ('hskt-full', '810d0f7d8575bc628c9b4c30383a49ecb547b78bdf73e2a3b805deaabd9e9103', 0, None),
    ('whiplash-full', 'c8626d3902002e0b2dca318fe8211565ccd4603e7467b998e307918291be675f', 0, None),
    ('china-repeat', '2693f11c0f6f605a25574e3a73032ef709ae6d64c0d8b7461fcff1a397c2e7bd', 200, 220),
]
regressions = []
for label, source_id, start, end in cases:
    folder = store / source_id
    status = preparation.read(folder / 'status.json')
    record = preparation.read(folder / 'A.json')
    assert preparation.sha(folder / 'A.json') == status['models']['A']['resultSha256']
    d2.compatibility.check_compatibility(record['contract'], current)
    assert status['originalExecutionContract'] == record['contract']
    assert preparation.sha(folder / 'canonical.wav') == status['source']['canonicalWavSha256']
    raw_path = folder / record['rawFile']
    assert preparation.valid_cache(folder / 'A.json', raw_path, status['models']['A']['cacheKey'],
                                   source_id, status['source']['decodedPcmSha256'])
    raw = preparation.read(raw_path)
    frames = [{'audioTime': t, 'scores': s} for t, s in zip(raw['times'], raw['scores'])]
    assert len(raw['times']) == len(raw['scores'])
    packet = {'variants': names, 'items': [{'id': label, 'frames': frames}]}
    replay = subprocess.run(['node', 'scripts/replay-early-percussion-decisions.mjs'],
                            input=json.dumps(packet).encode(), capture_output=True, check=True)
    run = json.loads(replay.stdout)['runs'][0]
    key = lambda e: (e['instrument'], round(e['time'], 8))
    duration = status['source']['duration']
    baseline = [e for e in run['variants']['L0']['events'] if 0 <= e['time'] < duration]
    assert sorted(map(key, baseline)) == sorted(map(key, record['events'])), ('Full-song L0 parity failed', label)
    stop = end if end is not None else duration
    events = {name: [e for e in run['variants'][name]['events'] if start <= e['time'] < stop] for name in names}
    change = run['comparison'][names[1]]
    regressions.append({'case': label, 'sourceSha256': source_id, 'sourceFilename': status['source']['originalFilename'],
                        'canonicalWavSha256': status['source']['canonicalWavSha256'],
                        'rawSha256': preparation.sha(raw_path), 'resultSha256': preparation.sha(folder / 'A.json'),
                        'range': [start, stop], 'referenceStatus': 'provisional-human-reference',
                        'officialMetricsCalculated': False, 'acousticConfidence': 'unverified', 'onsetUncertaintyMs': None,
                        'ambiguousIntervals': [{'start': start, 'end': stop, 'reason': 'No complete independent source-bound onset verification'}],
                        'scope': 'ADTOF decision replay only; frozen offline H0 keeps CNN Hats and is unchanged',
                        'counts': {n: dict(Counter(e['instrument'] for e in events[n])) for n in names},
                        'added': [e for e in change['added'] if start <= e['time'] < stop],
                        'removed': [e for e in change['removed'] if start <= e['time'] < stop],
                        'duplicateIds': {n: run['variants'][n]['duplicateIds'] for n in names},
                        'events': events, 'timingComparisonWholeSong': {k: v for k, v in change.items() if k not in ['added', 'removed']}})

# These are ambiguity-aware cross-class associations, not a clean confusion
# matrix: natural annotations can omit attacks and simultaneous hits can overlap.
associations = []
for view in confirmation['scored']:
    if view['kind'] != 'independent-natural-reference' or view['labelMode'] != 'instrument':
        continue
    counts = Counter()
    for cls in ['kick', 'snare', 'hat']:
        row = view['classes'][cls]
        matched = {p['predictionIndex'] for p in row['pairs']}
        for index, t in enumerate(row['predictionTimes']):
            if index in matched:
                continue
            nearby = [other for other in ['kick', 'snare', 'hat'] if other != cls
                      and any(abs(r - t) <= .05 for r in view['classes'][other]['referenceTimes'])]
            if nearby:
                counts[cls + ' near ' + '+'.join(nearby)] += 1
    associations.append({'id': view['id'], 'variant': view['lane'], 'domain': view['domain'], 'counts': dict(counts)})

output = {'selectionSha256': d2.evidence.sha(OUT / 'selection.json'),
          'confirmationSha256': d2.evidence.sha(OUT / 'confirmation.json'), 'neuralInferenceRun': False,
          'segments': segments, 'segmentRegressions': segment_regressions, 'songRegressions': regressions,
          'crossClassAssociations': associations, 'physicalSynchronization': 'UNVERIFIED'}
assert not (OUT / 'regressions.json').exists(), 'Do not overwrite recorded regression evidence'
d2.write(OUT / 'regressions.json', output)
print(json.dumps({'segmentRegressions': segment_regressions,
                  'songs': [{'case': r['case'], 'counts': r['counts'], 'added': len(r['added']), 'removed': len(r['removed'])} for r in regressions],
                  'neuralInferenceRun': False}))
