"""Attest the recorded TorchAudio build without repeating completed inference."""
import ast
import importlib.metadata
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('evidence',Path(__file__).with_name('beat-v2-evidence.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
root=e.ROOT;previous=root/'pre-torchaudio-guard'
old=e.read(previous/'contracts.json')
before=ast.parse((previous/'beat-v2-evidence.py').read_text())
after=ast.parse(Path('scripts/beat-v2-evidence.py').read_text())
# The complete helper AST must differ only by this added dependency name.
removed=0
for node in ast.walk(after):
    if isinstance(node,ast.List):
        kept=[v for v in node.elts if not (isinstance(v,ast.Constant) and v.value=='torchaudio')]
        removed+=len(node.elts)-len(kept);node.elts=kept
assert removed==1 and ast.dump(before)==ast.dump(after)
assert e.sha(previous/'run-beat-v2-inference.py')==e.sha('scripts/run-beat-v2-inference.py')
version=importlib.metadata.version('torchaudio')
assert version=='2.8.0+cpu'
freeze=root/'environment-freeze.txt';installation=root/'torch-install.log'
assert 'torchaudio=='+version in freeze.read_text()
assert 'torchaudio=='+version in installation.read_text()
contracts={lane:e.identity(lane) for lane in old}
for lane,prior in old.items():
    current=contracts[lane]['contract']
    assert current=={**prior['contract'],
      'dependencies':{**prior['contract']['dependencies'],'torchaudio':version},
      'codeSha256':{**prior['contract']['codeSha256'],'scripts/beat-v2-evidence.py':e.sha('scripts/beat-v2-evidence.py')}}
archive=root/'pre-torchaudio-guard-records';archive.mkdir(exist_ok=False)
proof=e.read(previous/'c4-batching-parity.json')
assert proof['currentContractFingerprint']==old['C4']['fingerprint']
assert e.sha(root/'c4-batching-parity.json')==e.sha(previous/'c4-batching-parity.json')
proof['probeExecutionContractFingerprint']=proof['currentContractFingerprint']
proof['currentContractFingerprint']=contracts['C4']['fingerprint']
proof['dependencyGuardUpgrade']={
  'originalProofPath':str(previous/'c4-batching-parity.json'),
  'originalProofSha256':e.sha(previous/'c4-batching-parity.json'),
  'environmentFreezeSha256':e.sha(freeze),'installationLogSha256':e.sha(installation),
  'torchaudio':version,'scope':'Only dependency fingerprint expanded. Original probe execution fingerprint and batch-eight contract preserved; identical inference/loader source and all other dependencies. No neural execution repeated.'}
(root/'c4-batching-parity.json').write_text(json.dumps(proof,indent=2))
receipts=[]
for lane,contract in contracts.items():
    folder=root/('first-separator-cache' if lane=='first-separator' else 'results/'+lane)
    for path in sorted(folder.glob('*.json')):
        record=e.read(path)
        is_old_batch=lane=='C4' and record.get('executionBatchSize')==8
        if is_old_batch:
            assert record['evidenceIdentity']==proof['originalContract']
            assert record['semanticCompatibility']['compatibleCurrentFingerprint']==old[lane]['fingerprint']
        else:assert record['evidenceIdentity']==old[lane],(lane,path.name)
        backup=archive/(lane+'-'+path.name);backup.write_bytes(path.read_bytes())
        if record.get('firstSeparator'):
            separator=e.read(root/'first-separator-cache'/(record['id']+'.json'))
            assert record['firstSeparator']['sha256']==separator['sha256']
            record['firstSeparator']=separator
        record['dependencyGuardMigration']={
          'originalRecordPath':str(backup),'originalRecordSha256':e.sha(backup),
          'originalExecutionIdentity':record['evidenceIdentity'],
          'torchaudio':version,'environmentFreezeSha256':e.sha(freeze),
          'installationLogSha256':e.sha(installation),
          'scope':'Validation metadata only; identical complete inference source, model and existing dependency contracts. Recorded TorchAudio build now included. No prediction or runtime fields changed; no neural execution repeated.'}
        if is_old_batch:
            record['semanticCompatibility'].update(compatibleCurrentFingerprint=contract['fingerprint'],
              attestationSha256=e.sha(root/'c4-batching-parity.json'))
        else:record['evidenceIdentity']=contract
        path.write_text(json.dumps(record),encoding='utf-8')
        receipts.append({'lane':lane,'id':record['id'],'originalRecordSha256':e.sha(backup),
          'compatibleCurrentFingerprint':contract['fingerprint']})
assert len(receipts)==389
(root/'dependency-guard-migration.json').write_text(json.dumps({
  'retainedExecutions':len(receipts),'repeatedNeuralExecutions':0,
  'environmentFreezeSha256':e.sha(freeze),'installationLogSha256':e.sha(installation),
  'torchaudio':version,'records':receipts},indent=2))
print(json.dumps({'retainedExecutions':len(receipts),'repeatedNeuralExecutions':0,'torchaudio':version}))
