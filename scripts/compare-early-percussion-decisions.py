"""Approved offline L1 replay: development selection precedes locked confirmation."""
import argparse
import copy
import importlib.util
import json
import subprocess
import time
from pathlib import Path
import numpy as np


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


evidence = load_module('existing_evidence', 'scripts/beat-v2-evidence.py')
scoring = load_module('existing_scoring', 'scripts/score-beat-v2-round.py')
compatibility = load_module('timing_compatibility', 'scripts/attest-full-song-timing-compatibility.py')
ROOT = Path('scratch/beat-grid-v2')
OUT = Path('scratch/low-latency-semantic/l1')
SCRIPTS = ['scripts/compare-early-percussion-decisions.py', 'scripts/replay-early-percussion-decisions.mjs',
           'scripts/score-beat-v2-round.py', 'scripts/analyze-percussion-latency-floor.mjs']


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2), encoding='utf-8')


def accept_timing_only(old, current):
    assert old['fingerprint'] == evidence.digest(old['contract'])
    normalized = copy.deepcopy(current['contract'])
    for path, (before, after) in compatibility.TIMING_SOURCES.items():
        assert old['contract']['codeSha256'][path] == before
        assert normalized['codeSha256'][path] == after
        normalized['codeSha256'][path] = before
    assert normalized == old['contract'], 'Unreviewed model, frontend, dependency or execution change'


def admit():
    manifest = evidence.read(ROOT / 'corpus-manifest.json')
    frozen = evidence.read(ROOT / 'round-corpus-freeze.json')
    assert evidence.sha(ROOT / 'corpus-manifest.json') == frozen['manifestSha256']
    for binding in frozen['bindings'].values():
        for path, expected in binding['files'].items():
            assert evidence.sha(path) == expected, ('Changed corpus/reference', path)
    current = evidence.identity('BASE')
    assert current['contract']['modelSha256'] == 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a'
    bindings = {}
    for item in manifest['items']:
        path = ROOT / 'results/BASE' / (item['id'] + '.json')
        record = evidence.read(path)
        assert record['lane'] == 'BASE' and record['id'] == item['id']
        accept_timing_only(record['evidenceIdentity'], current)
        raw = path.with_suffix('.npz')
        evidence.validate(record, item, record['evidenceIdentity'], raw if record.get('rawOutputSha256') else None)
        if record.get('reusedEvidence'):
            assert record['reusedEvidence']['trace'] in frozen['bindings'][item['id']]['files']
            activation_path = Path(record['reusedEvidence']['trace'])
        else:
            assert record.get('rawOutputSha256')
            activation_path = raw
        bindings[item['id']] = {'resultSha256': evidence.sha(path), 'activationPath': str(activation_path),
                                'activationSha256': evidence.sha(activation_path)}
    return manifest, {'manifestSha256': frozen['manifestSha256'], 'freezeSha256': evidence.sha(ROOT / 'round-corpus-freeze.json'),
                      'modelContract': current, 'bindings': bindings,
                      'scripts': {p: evidence.sha(p) for p in SCRIPTS}, 'neuralInferenceRun': False}


def activation_frames(binding):
    path = Path(binding['activationPath'])
    if path.suffix == '.npz':
        with np.load(path) as raw:
            assert len(raw['times']) == len(raw['scores'])
            return [{'audioTime': float(t), 'scores': s.tolist()} for t, s in zip(raw['times'], raw['scores'])]
    trace = evidence.read(path)
    assert not trace.get('activationsTruncated') and not trace.get('eventsTruncated')
    assert trace['modelSha256'] == 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a'
    return trace['activations']


def replay_items(items, binding, names):
    packet = {'variants': names, 'items': [{'id': i['id'], 'frames': activation_frames(binding[i['id']])} for i in items]}
    result = subprocess.run(['node', 'scripts/replay-early-percussion-decisions.mjs'],
                            input=json.dumps(packet).encode(), capture_output=True, check=True)
    runs = json.loads(result.stdout)['runs']
    for item, run in zip(items, runs):
        assert item['id'] == run['id']
        saved = evidence.read(ROOT / 'results/BASE' / (item['id'] + '.json'))
        key = lambda e: (e['instrument'], round(e['time'], 8))
        actual = [e for e in run['variants']['L0']['events'] if 0 <= e['time'] < item['duration']]
        assert sorted(map(key, actual)) == sorted(map(key, saved['events'])), ('L0 event parity failed', item['id'])
        run['originalL0EventParity'] = True
    return runs


def summarize(items, runs, names):
    views, listening = [], []
    for item, run in zip(items, runs):
        for name in names:
            if item['scoreEligible']:
                for mode in ['instrument', 'displayRow']:
                    views.append(scoring.score(item, {'lane': name, 'events': run['variants'][name]['events']}, mode))
            else:
                offset = item['sourceStart'] - item.get('leadingSilenceSeconds', 0)
                listening.append({'id': item['id'], 'variant': name, 'referenceStatus': 'provisional-human-reference',
                                  'officialMetricsCalculated': False, 'sourceOffsetSeconds': offset,
                                  'uncertainty': 'Instrument identity, onset uncertainty and completeness unverified',
                                  'events': [{**e, 'sourceTime': e['time'] + offset} for e in run['variants'][name]['events']
                                             if item['analysisStart'] <= e['time'] < item['analysisEnd']]})
    groups = {}
    for view in views:
        group = (view['lane'], view['kind'], view['domain'], view['labelMode'])
        groups.setdefault(group, []).append(view)
    summary = [dict(zip(['variant', 'kind', 'domain', 'labelMode'], key), **scoring.aggregate(values))
               for key, values in groups.items()]
    return {'summary': summary, 'scored': views, 'listening': listening}


def screens(result, runs, names):
    findings = {}
    for name in names:
        if name == 'L0':
            continue
        reasons = []
        natural = [s for s in result['summary'] if s['variant'] == name
                   and s['kind'] == 'independent-natural-reference' and s['labelMode'] == 'instrument']
        for row in natural:
            base = next(s for s in result['summary'] if s['variant'] == 'L0'
                        and all(s[k] == row[k] for k in ['kind', 'domain', 'labelMode']))
            for cls in ['kick', 'snare', 'hat']:
                for metric, allowance in [('f1', .02), ('precision', .03), ('recall', .03),
                                          ('denseRecall', .02), ('overlapRecall', .02)]:
                    b, c = base['classes'][cls][metric], row['classes'][cls][metric]
                    if b is not None and (c is None or c < b - allowance - 1e-10):
                        reasons.append(f'{row["domain"]}/{cls}/{metric} regression')
        for row in result['scored']:
            if row['lane'] != name or row['kind'] != 'controlled-acoustic' or row['labelMode'] != 'instrument':
                continue
            base = next(s for s in result['scored'] if s['lane'] == 'L0' and s['id'] == row['id'] and s['labelMode'] == 'instrument')
            for cls in ['kick', 'snare', 'hat']:
                b, c = base['classes'][cls], row['classes'][cls]
                if c['tp'] < b['tp']:
                    reasons.append(f'{row["id"]}/{cls} lost synthetic matches')
                if not c['referenceTimes'] and c['fpAgainstReference'] > b['fpAgainstReference']:
                    reasons.append(f'{row["id"]}/{cls} added absent-row events')
        if any(r['variants'][name]['duplicateIds'] for r in runs):
            reasons.append('Duplicate display class/time identities')
        savings = [r['comparison'][name]['inputReleaseSavingsByUnknownPhase'] for r in runs]
        if not any(all(p['savingsMs'] and p['savingsMs']['p95'] >= 10 - 1e-8 for p in stream) for stream in savings):
            reasons.append('No material retained-event release reduction robust to unknown batch phase')
        macro = np.mean([r['classes'][c]['f1'] or 0 for r in natural for c in ['kick', 'snare', 'hat']])
        findings[name] = {'eligibleForRuntime': not reasons, 'reasons': reasons, 'naturalMacroF1': float(macro),
                          'latencyScope': 'Input dependency savings p95 must exceed 10ms in a compared stream under every possible batch phase. No measured browser improvement.'}
    return findings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', required=True, choices=['development', 'confirmation'])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest, admitted = admit()
    if args.phase == 'development':
        assert not (OUT / 'selection.json').exists(), 'Selection already frozen; do not overwrite'
        names = ['L0', 'L1-gap0', 'L1-immediate']
        items = [i for i in manifest['items'] if i['partition'] == 'development']
    else:
        selection = evidence.read(OUT / 'selection.json')
        assert selection['admission'] == admitted, 'Evaluator or evidence changed after selection'
        assert selection['developmentResultSha256'] == evidence.sha(OUT / 'development.json')
        assert not (OUT / 'confirmation.json').exists(), 'Locked confirmation already exists'
        names = ['L0', selection['selected']]
        items = [i for i in manifest['items'] if i['partition'] == 'locked-holdout']
    runs = replay_items(items, admitted['bindings'], names)
    result = summarize(items, runs, names)
    result.update(phase=args.phase, variants=names, admission=admitted, runs=runs,
                  screens=screens(result, runs, names), createdAt=time.time(),
                  physicalSynchronization='UNVERIFIED', browserLatencyImprovementMeasured=False)
    write(OUT / (args.phase + '.json'), result)
    if args.phase == 'development':
        eligible = [n for n in names[1:] if result['screens'][n]['eligibleForRuntime']]
        selected = max(eligible, key=lambda n: result['screens'][n]['naturalMacroF1']) if eligible else 'L1-gap0'
        write(OUT / 'selection.json', {'selected': selected, 'developmentEligible': bool(eligible),
              'policy': 'Highest development natural macro F1 among passing screens; gap0 diagnostic if all fail; no holdout tuning',
              'admission': admitted, 'developmentResultSha256': evidence.sha(OUT / 'development.json'), 'frozenAt': time.time()})
    print(json.dumps({'phase': args.phase, 'inputs': len(items), 'screens': result['screens'], 'neuralInferenceRun': False}))


if __name__ == '__main__':
    main()
