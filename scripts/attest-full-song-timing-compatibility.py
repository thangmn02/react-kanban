"""One-time, fail-closed reuse of caches predating nonsemantic timing metadata."""
import argparse
import copy
import hashlib
import importlib.util
import json
import re
import time
from pathlib import Path

TIMING_SOURCES = {
    'extensions/kanban-music/percussion-features.js': (
        '758dbf5b89fa1865a0495545d10d58ceeb9595970f7fa6d360c248b05cf4bf82',
        '0abd2a532ab585509fab0e93cf174ec763bee6b0b317550175bcf9a3c8355317'),
    'extensions/kanban-music/percussion-classifier.js': (
        '3208306dfd8b4bdb52cfece3cd454350885b34fa81eed05006cfe31ea536b994',
        'c84142ba2a4c202211a6182d00cc3eadf192ff5ecbf10f5675b0a64c0ac733b0'),
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def check_compatibility(old, current):
    normalized = copy.deepcopy(current)
    for value in [old, current]:
        a = value['identities']['A']
        if a['fingerprint'] != digest(a['contract']):
            raise ValueError('Invalid A contract fingerprint')
        if a['contract']['modelSha256'] != 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a':
            raise ValueError('Not the frozen A checkpoint')
        if value['identities']['B']['contract']['modelSha256'] != '785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db':
            raise ValueError('Not the frozen B checkpoint')
    for path, (before, after) in TIMING_SOURCES.items():
        if old['identities']['A']['contract']['codeSha256'].get(path) != before or current['identities']['A']['contract']['codeSha256'].get(path) != after:
            raise ValueError('Unreviewed timing source revision: ' + path)
        normalized['identities']['A']['contract']['codeSha256'][path] = before
    normalized['identities']['A']['fingerprint'] = old['identities']['A']['fingerprint']
    if normalized != old:
        raise ValueError('Contract changes extend beyond the reviewed timing-only sources')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', default='scratch/low-latency-semantic/h0-cache-attestation')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('full_song_preparation', 'scripts/prepare-full-song.py')
    preparation = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(preparation)
    _, current = preparation.contracts()
    for path, (_, expected) in TIMING_SOURCES.items():
        if preparation.sha(path) != expected:
            raise ValueError('Current source bytes changed')
    store = Path('scratch/acoustic-visual-lab/full-songs').resolve()
    index = preparation.read(store / 'songs.json')
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    plans, skipped = [], []
    for source_id in sorted(index['sources']):
        if not re.fullmatch('[a-f0-9]{64}', source_id):
            raise ValueError('Invalid source ID')
        folder = store / source_id
        status_path = folder / 'status.json'
        status = preparation.read(status_path)
        if status.get('contractSha256') == preparation.digest(current):
            skipped.append({'id': source_id, 'reason': 'Already current'})
            continue
        old = status.get('contract')
        if not old:
            skipped.append({'id': source_id, 'reason': 'No completed contract'})
            continue
        check_compatibility(old, current)
        if status.get('contractSha256') != preparation.digest(old):
            raise ValueError('Saved contract digest changed')
        if preparation.sha(folder / 'canonical.wav') != status['source']['canonicalWavSha256']:
            raise ValueError('Canonical audio changed')
        ready, hashes = [], {}
        for model, model_status in status.get('models', {}).items():
            path = folder / (model + '.json')
            if model not in ['A', 'B', 'C'] or not path.exists() or not model_status.get('resultSha256'):
                continue
            if preparation.sha(path) != model_status['resultSha256']:
                raise ValueError('Saved result bytes changed')
            record = preparation.read(path)
            if record.get('contract') != old or not re.fullmatch(r'models/[a-f0-9]{64}/raw\.json', record.get('rawFile', '')):
                raise ValueError('Unexpected original result binding')
            raw = folder / record['rawFile']
            if not preparation.valid_cache(path, raw, model_status['cacheKey'], source_id, status['source']['decodedPcmSha256']):
                raise ValueError('Invalid raw/event/source cache binding')
            ready.append(model)
            hashes[model] = {'resultSha256': preparation.sha(path), 'rawSha256': preparation.sha(raw)}
        if not all(model in ready for model in ['A', 'B']):
            skipped.append({'id': source_id, 'reason': 'No complete valid frozen A/B pair'})
            continue
        backup = output / (source_id + '-original-status.json')
        if backup.exists():
            raise ValueError('Refusing to overwrite an original status backup')
        plans.append((status_path, backup, status, ready, hashes))
    receipts = []
    for path, backup, status, ready, hashes in plans:
        original = path.read_bytes()
        old = status['contract']
        proof = {'method': 'Explicit compatibility attestation for pinned timing-only revisions; feature values and learned decisions unchanged. Original model execution records retained.',
                 'acceptedAt': time.time(), 'originalStatusSha256': hashlib.sha256(original).hexdigest(),
                 'originalContractSha256': status['contractSha256'], 'acceptedCurrentContractSha256': preparation.digest(current),
                 'originalStatusPath': str(backup), 'modelFilesUnchanged': hashes, 'inferenceRun': False,
                 'accuracyQualified': False, 'evidence': 'Prior feature/decision parity tests and D1 unchanged-event activation replays; source revisions pinned in this script.'}
        status['originalExecutionContract'] = old
        status['contract'] = current
        status['contractSha256'] = preparation.digest(current)
        status['compatibilityAttestation'] = proof
        for model in ready:
            status['models'][model]['state'] = 'READY'
        status['state'] = 'READY' if all(v['state'] == 'READY' for v in status['models'].values()) else 'PARTIAL'
        status.pop('error', None)
        if args.apply:
            backup.write_bytes(original)
            preparation.write(path, status)
            for model, expected in hashes.items():
                if preparation.sha(path.parent / (model + '.json')) != expected['resultSha256']:
                    raise ValueError('Result changed during attestation')
        receipts.append({'id': path.parent.name, 'models': ready, **proof})
    receipt = {'applied': args.apply, 'restored': receipts, 'skipped': skipped,
               'modelOrRawFilesModified': False, 'neuralInferenceRun': False}
    (output / ('applied.json' if args.apply else 'dry-run.json')).write_text(json.dumps(receipt, indent=2))
    print(json.dumps({'applied': args.apply, 'compatibleSources': len(receipts), 'skipped': len(skipped), 'neuralInferenceRun': False}))


if __name__ == '__main__':
    main()
