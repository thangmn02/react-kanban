"""Fail-closed identities for private model evidence, separate from score selection."""
import hashlib
import importlib.metadata
import json
from pathlib import Path

ROOT=Path('scratch/beat-grid-v2').resolve()
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def equivalent_input(executed,item):
    if executed==item['sha256']:return True
    alias=read(ROOT/'decoded-pcm-aliases.json').get(item['id'],{})
    return (alias.get('executedContainerSha256')==executed and
      alias.get('canonicalContainerSha256')==item['sha256'] and
      alias.get('decodedPcmSha256')==item.get('decodedPcmSha256'))

def identity(lane):
    registry=read(ROOT/'identity-reuse-registry.json')
    assert registry['preBenchmarkGate'].startswith('PASS')
    files=['scripts/beat-v2-evidence.py']
    if lane=='first-separator':
        files+=['scripts/separate-beat-v2-inputs.py','scripts/measure-beat-v2-separator-overhead.py']
        model=ROOT/'weights/first-separator/955717e8.safetensors'
        expected='d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd'
        import demucs
        folder=Path(demucs.__file__).parent
        files += [folder/f for f in ['apply.py','hdemucs.py','htdemucs.py','hf.py']]
    else:
        files+=['scripts/run-beat-v2-inference.py']
        key='C2' if lane=='C2-separated' else 'C3-compatible' if lane=='C3' else lane
        if lane=='C4':
            model=ROOT/'weights/C4/setting-tau-0.8/model.safetensors'
            expected='f94d1773d929166e0a3f63d305975aa6667512f8a71d7706872e1f8b23ca930b'
            files+=sorted((ROOT/'sources/C4-hub').rglob('*.py'))
            files+=sorted((ROOT/'weights/C4/setting-tau-0.8').glob('*.json'))
            files+=sorted((ROOT/'weights/C4/setting-tau-0.8').glob('*.yaml'))
        else:model=Path(registry['models'][key]['path']);expected=registry['models'][key]['containerSha256']
        if lane in ['C2','C2-separated']:
            repair=read(ROOT/'c2-output-contract-repair.json')
            assert repair['sourceSha256']==expected and sha(model)==expected
            model=Path(repair['path']);expected=repair['derivedSha256']
            files+=['scripts/repair-beat-v2-oaf-output.py',ROOT/'sources/C2-conversion/pinned-drum_mappings.py',
              ROOT/'sources/C2-conversion/pinned-configs.py',ROOT/'c2-output-contract-repair.json']
        if lane=='BASE':files+=['scripts/beat-v2-baseline-bridge.mjs',*registry['baselineContracts'].keys()]
        if lane=='C1':files+=[ROOT/'sources/C1/webUI/server.py']
        if lane=='C3':
            import demucs
            files+=[Path(demucs.__file__).parent/'hdemucs.py']
    assert sha(model)==expected,('Checkpoint identity mismatch',lane)
    deps={p:importlib.metadata.version(p) for p in ['numpy','scipy','soundfile','librosa','onnxruntime','torch','torchaudio','demucs','transformers']}
    payload={'lane':lane,'baseRevision':registry['baseRevision'],'modelSha256':expected,
      'registrySha256':sha(ROOT/'identity-reuse-registry.json'),
      'codeSha256':{str(p):sha(p) for p in files},'dependencies':deps,
      'runtime':{'cpuThreads':4,'provider':'CPU','precision':'float32',**({'chunkBatchSize':1} if lane=='C4' else {})}}
    return {'fingerprint':digest(payload),'contract':payload}

def validate(record,item,contract,raw_path=None):
    if record['evidenceIdentity']!=contract:
        # Retain actual batch-eight identity; qualify semantic reuse separately.
        assert record.get('lane')=='C4' and record.get('executionBatchSize')==8,('Stale model/pipeline evidence',record.get('id'))
        compatibility=record['semanticCompatibility'];proof=read(ROOT/'c4-batching-parity.json')
        assert compatibility['attestationSha256']==sha(ROOT/'c4-batching-parity.json')
        assert proof['status']=='PASS' and proof['currentContractFingerprint']==contract['fingerprint']
        assert proof['originalContract']==record['evidenceIdentity']
        assert compatibility['compatibleCurrentFingerprint']==contract['fingerprint']
    assert equivalent_input(record['inputSha256'],item),('Different input',item['id'])
    if record.get('rawOutputSha256') is not None:
        assert raw_path is not None and Path(raw_path).is_file(),('Missing declared raw output',item['id'])
        assert record['rawOutputSha256']==sha(raw_path),('Changed raw output',item['id'])
    if 'rawEvents' in record:
        assert record['rawEventsSha256']==digest(record['rawEvents']),('Changed raw events',item['id'])
    if record.get('reusedEvidence'):
        assert record['reusedTraceSha256']==sha(record['reusedEvidence']['trace']),('Changed replay trace',item['id'])
    if record.get('firstSeparator'):
        separator=record['firstSeparator']
        assert separator['sha256']==sha(separator['path'])
        assert separator['evidenceIdentity']==identity('first-separator')
        assert equivalent_input(separator['sourceSha256'],{**item,'sha256':record['originalInputSha256']})
        assert separator['seedIdentitySha256'] in [separator['sourceSha256'],item['decodedPcmSha256']]
        assert separator['realizedSeed']==int(separator['seedIdentitySha256'][:8],16)
        overhead=separator['overheadMeasurement']
        assert overhead['outputSha256']==separator['sha256']
        assert overhead['canonicalInputSha256']==record['originalInputSha256']
        assert overhead['scriptSha256']==sha('scripts/measure-beat-v2-separator-overhead.py')
