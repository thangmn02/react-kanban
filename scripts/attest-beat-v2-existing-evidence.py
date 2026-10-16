"""Explicitly migrate earlier valid evidence; preserve original records and execution provenance."""
import ast
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('beat_v2_evidence',Path(__file__).with_name('beat-v2-evidence.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
root=e.ROOT
manifest=e.read(root/'corpus-manifest.json')
archive=root/'pre-contract-records';archive.mkdir(exist_ok=True)
def function(path,name):
    node=next(n for n in ast.parse(Path(path).read_text()).body if isinstance(n,ast.FunctionDef) and n.name==name)
    return ast.dump(node,include_attributes=False)
old=root/'pre-contract-scripts/run-beat-v2-inference.py'
assert function(old,'infer')==function('scripts/run-beat-v2-inference.py','infer')
assert function(old,'instrument')==function('scripts/run-beat-v2-inference.py','instrument')
registry=e.read(root/'identity-reuse-registry.json')
for path,expected in registry['baselineContracts'].items():assert e.sha(path)==expected
receipts=[]
for lane,folder in [('BASE','results/BASE'),('first-separator','first-separator-cache')]:
    contract=e.identity(lane)
    for path in sorted((root/folder).glob('*.json')):
        record=e.read(path)
        if 'evidenceIdentity' in record:
            assert record['evidenceIdentity']==contract
            continue
        item=next(i for i in manifest['items'] if i['id']==record['id'])
        backup=archive/(lane+'-'+path.name)
        assert not backup.exists()
        backup.write_bytes(path.read_bytes())
        proof={'method':'post-execution compatibility attestation; identities were not captured in original record',
          'originalRecordSha256':e.sha(backup),'originalRecordPath':str(backup),
          'originalExecutionScriptSha256':e.sha(root/'pre-contract-scripts'/('separate-beat-v2-inputs.py' if lane=='first-separator' else 'run-beat-v2-inference.py'))}
        if lane=='BASE':
            assert e.equivalent_input(record['inputSha256'],item)
            proof['basis']='Exact unchanged infer/instrument AST, verified frozen production frontend/classifier/config, checkpoint and PCM equivalence'
            raw=path.with_suffix('.npz')
            record['rawOutputSha256']=e.sha(raw) if raw.exists() else None
            if record.get('priorRuntimeNotCompared'):
                record['runtimeStatus']='NOT COMPARABLE: prior activations replayed for correctness only'
                for key in ['coldLoadSeconds','fullPipelineColdLoadSeconds','residentPeakBytes','cpuSeconds',
                  'cpuHostUtilizationPercent','elapsedSeconds','fullPipelineSeconds','rtf','preprocessingSeconds',
                  'inferenceSeconds','postprocessingSeconds','childCpuSeconds']:record[key]=None
        else:
            assert e.equivalent_input(record['sourceSha256'],item)
            assert record['modelSha256']==contract['contract']['modelSha256']
            assert e.sha(record['path'])==record['sha256']
            assert record['options']=={'shifts':1,'split':True,'overlap':.25,'cpuThreads':4,
              'normalization':'official CLI mono mean/std; deterministic input-hash RNG seed'}
            # Retain the historical realized seed as part of this execution, not a claim
            # that a new seed produces the identical output. No neural rerun is needed.
            record['realizedSeed']=int(record['sourceSha256'][:8],16)
            record['seedIdentitySha256']=record['sourceSha256']
            record['seedPolicy']='historical realized container-hash seed retained explicitly; future inputs use decoded PCM hash'
            proof['basis']='Same checkpoint, official Demucs preprocessing/options and dependencies; retain original numeric RNG seed and exact stem bytes'
        record['evidenceIdentity']=contract;record['compatibilityAttestation']=proof
        path.write_text(json.dumps(record),encoding='utf-8')
        receipts.append({'lane':lane,'id':item['id'],**proof})
(root/'evidence-compatibility-attestations.json').write_text(json.dumps(receipts,indent=2))
print(json.dumps({'attested':len(receipts),'rerunNeuralInference':False}))
