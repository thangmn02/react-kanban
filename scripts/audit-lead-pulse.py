"""Read-only candidate/filter audit of frozen, authorized local Lead fixtures."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src-tauri/target/lead-precision-recall'
BASE = ROOT / 'src-tauri/target/lead-pulse'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def linux_path(url):
    return ROOT / url.lstrip('/')


def inspect_fixture(fixture, lead):
    identity = fixture['id'].removeprefix('lead-')
    original = linux_path(fixture['originalUrl'])
    archive = original.parent / ('stems-0.0.npz' if fixture['provenance']['split'] == 'regression' else 'stems.npz')
    saved = json.loads((BASE / identity / 'lead.json').read_text())
    if sha(archive) != saved['stemArchiveSha256'] or sha(original) != fixture['audioSha256']:
        raise ValueError('fixture_input_identity_changed')
    with np.load(archive, allow_pickle=False) as data:
        rate = int(data['rate'])
        stems = {name: data[name] for name in (*lead.SOURCES, 'drums') if name in data}
    pitches = {}
    source_order = iter(lead.SOURCES)

    def extract(signal, sample_rate):
        name = next(source_order)
        notes = lead.extract_pitch(signal, sample_rate)
        pitches[name] = notes
        return notes

    # These saved fixtures have audible content in all four candidate stems.
    measured = {name: lead.features(stems[name], rate) for name in lead.SOURCES}
    active_names = [name for name in lead.SOURCES if np.max(measured[name]['rms']) >= lead.POLICY['absoluteRmsFloor']]
    source_order = iter(active_names)
    replay = lead.analyze_sources(stems, rate, extract)
    for name in lead.SOURCES:
        pitches.setdefault(name, [])
    if replay['events'] != saved['events'] or replay['sections'] != saved['sections']:
        raise ValueError('frozen_baseline_did_not_reproduce: ' + identity)
    drums = lead.features(stems['drums'], rate) if 'drums' in stems else None
    vocal = lead.vocal_attacks(measured['vocals'], drums)
    proposals = []
    for source in lead.SOURCES:
        proposals.extend({**note, 'source': source, 'kind': 'pitched-note'} for note in pitches[source])
    proposals.extend({**note, 'source': 'vocals'} for note in vocal)
    accepted = {(n['source'], n['kind'], n['start']): n for n in saved['events']}
    decisions = []
    for proposal in proposals:
        start = proposal['start']
        section = next((s for s in saved['sections'] if s['start'] <= start < s['end']), None)
        emitted = accepted.get((proposal['source'], proposal['kind'], start))
        previous = next((n for n in reversed(saved['events']) if n['start'] <= start), None)
        reason = 'emitted' if emitted else 'ownership' if not section or section['source'] != proposal['source'] else 'spacing'
        spacing = lead.POLICY['vocalSpacing'] if proposal['source'] == 'vocals' else lead.POLICY['noteSpacing']
        competitor = previous if reason == 'spacing' and previous and start - previous['start'] < spacing else None
        i = int(np.argmin(abs(measured[proposal['source']]['time'] - start)))
        values = measured[proposal['source']]
        decisions.append({**proposal, 'decision': reason, 'owner': section['source'] if section else None,
                          'competitor': competitor, 'acoustic': {k: float(values[k][i]) for k in ('rms', 'body', 'flatness', 'flux')}})
    mismatches = [d for d in decisions if d['decision'] == 'spacing' and d['kind'] == 'vocal-articulation'
                  and d['competitor'] and d['competitor']['kind'] == 'pitched-note']
    result = {'fixtureId': fixture['id'], 'audioSha256': fixture['audioSha256'], 'archive': str(archive),
              'notes': pitches, 'vocal': vocal, 'decisions': decisions,
              'features': {name: {k: v.tolist() for k, v in values.items()} for name, values in measured.items()},
              'baselineReproducedExactly': True}
    (OUT / (identity + '-audit.json')).write_text(json.dumps(result, allow_nan=False))
    return {'id': identity, 'events': len(saved['events']), 'proposals': len(proposals),
            'ownershipRejected': sum(d['decision'] == 'ownership' for d in decisions),
            'spacingRejected': sum(d['decision'] == 'spacing' for d in decisions),
            'articulationSuppressedByEarlierPitch': len(mismatches),
            'examples': [{'start': d['start'], 'earlierPitch': d['competitor']['start'],
                          'deltaMs': (d['start'] - d['competitor']['start']) * 1000} for d in mismatches[:3]]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frozen = OUT / 'frozen-v1'
    frozen.mkdir(exist_ok=True)
    policy = ROOT / 'server/audio-analysis/lead-pulse.py'
    manifest = BASE / 'fixtures.json'
    fixtures = json.loads(manifest.read_text())['fixtures']
    identities = {str(p.relative_to(ROOT)): sha(p) for p in (policy, manifest)}
    copies = [(policy, frozen / 'lead-pulse.py'), (manifest, frozen / 'fixtures.json')]
    for fixture in fixtures:
        p = BASE / fixture['id'].removeprefix('lead-') / 'lead.json'
        identities[str(p.relative_to(ROOT))] = sha(p)
        copies.append((p, frozen / fixture['id'] / 'lead.json'))
    lock = frozen / 'identities.json'
    if lock.exists() and json.loads(lock.read_text()) != identities:
        raise ValueError('frozen_v1_changed')
    lock.write_text(json.dumps(identities, indent=2))
    for src, dest in copies:
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
        if sha(dest) != identities[str(src.relative_to(ROOT))]:
            raise ValueError('frozen_copy_changed: ' + str(dest))
    spec = importlib.util.spec_from_file_location('frozen_lead', frozen / 'lead-pulse.py')
    lead = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lead)
    summaries = []
    for fixture in fixtures:
        summary = inspect_fixture(fixture, lead)
        summaries.append(summary)
        print(json.dumps(summary), flush=True)
    (OUT / 'audit-summary.json').write_text(json.dumps(summaries, indent=2))


if __name__ == '__main__':
    main()
