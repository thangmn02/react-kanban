"""Preserve neural evidence when only fail-closed validation guards change."""
import ast,importlib.util,json,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('evidence',Path(__file__).with_name('beat-v2-evidence.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
root=e.ROOT;previous=root/'pre-validation-guard-scripts'
def function(path,name):
    node=next(n for n in ast.parse(Path(path).read_text()).body if isinstance(n,ast.FunctionDef) and n.name==name)
    # C2 is explicitly invalidated and rerun. Prove every other neural path equal.
    if name=='infer':
        for branch in ast.walk(node):
            if isinstance(branch,ast.If) and ast.unparse(branch.test) in ["lane in ['C2', 'C2-separated']","lane == 'C4'"]:branch.body=[ast.Pass()]
    if name=='load':
        node.body=[n for n in node.body if not (isinstance(n,ast.If) and ast.unparse(n.test)=="lane in ['C2', 'C2-separated']")]
    return ast.dump(node,include_attributes=False)
for name in ['infer','instrument','load','baseline_bridge']:
    assert function(previous/'run-beat-v2-inference.py',name)==function('scripts/run-beat-v2-inference.py',name)
for name in ['equivalent_input','digest','sha']:
    assert function(previous/'beat-v2-evidence.py',name)==function('scripts/beat-v2-evidence.py',name)
old=e.read(previous/'contracts.json');frozen=e.read(root/'round-corpus-freeze.json')
assert e.sha(root/'corpus-manifest.json')==frozen['manifestSha256']
archive=root/'pre-validation-guard-records';archive.mkdir(exist_ok=True)
receipts=[]
for lane in ['first-separator','BASE','C1','C2','C2-separated','C3','C4']:
    contract=e.identity(lane)
    folder=root/('first-separator-cache' if lane=='first-separator' else 'results/'+lane)
    if lane in ['C2','C2-separated']:
        assert not list(folder.glob('*.json')),'Archive invalid-selector C2 results before compatibility migration'
        continue
    for key,value in old[lane]['contract'].items():
        if key=='runtime' and lane=='C4':
            assert contract['contract'][key]=={**value,'chunkBatchSize':1}
        elif key!='codeSha256':assert contract['contract'][key]==value,('Unexpected semantic/runtime change',lane,key)
    allowed={'scripts/beat-v2-evidence.py','scripts/run-beat-v2-inference.py'}
    for file,expected in old[lane]['contract']['codeSha256'].items():
        if file not in allowed:assert contract['contract']['codeSha256'][file]==expected
    for path in sorted(folder.glob('*.json')):
        record=e.read(path)
        if record['evidenceIdentity']==contract:continue
        if lane=='C4' and record.get('semanticCompatibility',{}).get('compatibleCurrentFingerprint')==contract['fingerprint']:continue
        assert record['evidenceIdentity']==old[lane],('Unknown execution contract',lane,path.name)
        backup=archive/(lane+'-'+path.name);assert not backup.exists();backup.write_bytes(path.read_bytes())
        if lane=='first-separator':assert e.sha(record['path'])==record['sha256']
        else:
            if record.get('rawOutputSha256'):assert e.sha(path.with_suffix('.npz'))==record['rawOutputSha256']
            record['rawEventsSha256']=e.digest(record['rawEvents'])
            if record.get('reusedEvidence'):
                trace=record['reusedEvidence']['trace'];expected=frozen['bindings'][record['id']]['files'][trace]
                assert e.sha(trace)==expected;record['reusedTraceSha256']=expected
            if record.get('firstSeparator'):
                separator=e.read(root/'first-separator-cache'/(record['id']+'.json'))
                assert record['firstSeparator']['sha256']==separator['sha256']
                assert record['firstSeparator']['realizedSeed']==separator['realizedSeed']
                record['firstSeparator']=separator
                overhead=separator['overheadMeasurement']
                seconds=overhead['preparationSeconds']+overhead['outputSerializationSeconds']
                record['fullPipelineSeconds']+=seconds
                record['rtf']=record['fullPipelineSeconds']/next(i['duration'] for i in e.read(root/'corpus-manifest.json')['items'] if i['id']==record['id'])
                record['cpuSeconds']+=overhead['cpuSeconds']
                record['cpuHostUtilizationPercent']=record['cpuSeconds']/record['fullPipelineSeconds']/os.cpu_count()*100
                record['costScope']='Measured stage sum; first-separator preparation/serialization measured separately without repeating neural execution; evaluation raw-output recording included.'
        record['validationGuardMigration']={'originalRecordSha256':e.sha(backup),'originalRecordPath':str(backup),
          'reason':'Validation/raw/replay guards strengthened and previously untimed separator I/O stages measured separately. Non-C2 infer/instrument/load/bridge AST and actual model/dependency contracts unchanged. C2 was invalidated separately. No retained neural computation repeated.',
          'originalExecutionIdentity':old[lane]}
        if lane=='C4':
            proof=e.read(root/'c4-batching-parity.json')
            assert proof['status']=='PASS' and proof['originalContract']==old[lane]
            assert proof['currentContractFingerprint']==contract['fingerprint']
            record['executionBatchSize']=8
            record['semanticCompatibility']={'compatibleCurrentFingerprint':contract['fingerprint'],
              'attestationSha256':e.sha(root/'c4-batching-parity.json'),
              'scope':'Actual batch-eight execution identity and timing retained; compatible model semantics supported by row-independence review and bounded exact-note parity probes. Unprobed inputs were not rerun.'}
        else:record['evidenceIdentity']=contract
        path.write_text(json.dumps(record),encoding='utf-8')
        receipts.append({'lane':lane,'id':record['id'],'originalRecordSha256':e.sha(backup),'newCompatibilityFingerprint':contract['fingerprint']})
(root/'validation-guard-migration.json').write_text(json.dumps(receipts,indent=2))
print(json.dumps({'retainedExecutions':len(receipts),'repeatedNeuralExecutions':0}))
