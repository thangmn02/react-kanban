"""Score complete constructed controls; compare both decisions on one live score stream."""
import importlib.util
import json
import subprocess
from pathlib import Path

spec = importlib.util.spec_from_file_location('early_comparison', 'scripts/compare-early-percussion-decisions.py')
d2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d2)
root = Path('scratch/low-latency-semantic')
runtime_path = root / 'l1-rapid-runtime.json'
runtime = d2.evidence.read(runtime_path)
fixtures = d2.evidence.read(root / 'synthetic-inputs.json')
assert runtime['candidate'] == 'early-finalization'
assert runtime['model']['sha256'] == 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a'
selection = d2.evidence.read(d2.OUT / 'selection.json')
assert selection['selected'] == 'L1-gap0'
assert not runtime['pageErrors']
runs = []
for original in runtime['results']:
    assert not original['eventsTruncated'] and not original['activationsTruncated'] and not original['failures']
    fixture = next(i for i in fixtures['items'] if original['input'] == '/pcm/d1-' + i['id'] + '.f32')
    pcm = Path('scratch/browser-first-corpus') / ('d1-' + fixture['id'] + '.f32')
    assert d2.evidence.sha(pcm) == fixture['pcmSha256']
    packet = {'variants': ['L0', 'L1-gap0'], 'items': [{'id': fixture['id'], 'frames': original['activations']}]}
    replay = subprocess.run(['node', 'scripts/replay-early-percussion-decisions.mjs'], input=json.dumps(packet).encode(),
                            capture_output=True, check=True)
    run = json.loads(replay.stdout)['runs'][0]
    origin = original['audioOrigin']
    def identities(events):
        return sorted((e['band'], round(e.get('time', e.get('audioTime')), 8)) for e in events
                      if origin <= e.get('time', e.get('audioTime')) < origin + original['seconds'])
    assert identities(run['variants']['L1-gap0']['events']) == identities(original['events']), 'Actual worker differs from approved decision replay'
    item = {**fixture, 'id': fixture['id'], 'references': fixture.get('references', fixture.get('events')), 'scoreEligible': True,
            'partition': 'locked-holdout', 'domain': 'drum-only'}
    scored, segments = {}, []
    for name in ['L0', 'L1-gap0']:
        record = {'lane': name, 'events': [{**e, 'time': e['time'] - origin} for e in run['variants'][name]['events']]}
        scored[name] = d2.scoring.score(item, record)
        for segment in item.get('segments', []):
            segments.append({'intervalMs': segment['intervalMs'], **d2.scoring.score(
                {**item, 'analysisStart': segment['start'], 'analysisEnd': segment['end']}, record)})
    regressions = []
    for cls in ['kick', 'snare', 'hat']:
        a, b = scored['L0']['classes'][cls], scored['L1-gap0']['classes'][cls]
        if b['tp'] < a['tp'] or not b['referenceTimes'] and b['fpAgainstReference'] > a['fpAgainstReference']:
            regressions.append(cls)
    for view in segments:
        if view['lane'] != 'L1-gap0':
            continue
        base = next(v for v in segments if v['lane'] == 'L0' and v['intervalMs'] == view['intervalMs'])
        for cls in ['kick', 'snare', 'hat']:
            if view['classes'][cls]['tp'] < base['classes'][cls]['tp']:
                regressions.append(f'{cls}/{view["intervalMs"]}ms')
    runs.append({'id': fixture['id'], 'scored': scored, 'segments': segments, 'regressions': regressions,
                 'actualWorkerEventParity': True, 'maxQueue': original['maxQueue'], 'stages': original['stages'],
                 'latency': original['latency'], 'visibleFlash': original['visibleFlash'],
                 'workerEvents': len(original['events']),
                 'unobservedRendererTraces': [{'band': e['band'], 'excerptTime': e['excerptTime'],
                     'sameBatchSameBandTimes': [other['excerptTime'] for other in original['events']
                         if other['band'] == e['band'] and other['mainThreadReceivedAt'] == e['mainThreadReceivedAt']],
                     'scope': 'No visible trace sample. Latest trace per row can coalesce proposals from one worker batch; not proof of a missing verified acoustic hit.'}
                    for e in original['events'] if not isinstance(e.get('visibleAudioTime'), (int, float))]})
output = {'scope': 'Complete-by-construction controls only; L0 is a decision replay on the same actual L1 runtime activations, not a second delivery measurement',
          'runtimeSha256': d2.evidence.sha(runtime_path), 'runs': runs, 'physicalSynchronization': 'UNVERIFIED'}
d2.write(d2.OUT / 'runtime-controls.json', output)
print(json.dumps({'runs': len(runs), 'regressions': {r['id']: r['regressions'] for r in runs},
                  'allWorkerParity': all(r['actualWorkerEventParity'] for r in runs)}))
