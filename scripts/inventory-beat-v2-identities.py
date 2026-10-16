"""Model-level identity inventory; format changes never establish novelty."""
import hashlib
import json
from pathlib import Path
import onnx
from onnx import numpy_helper

root=Path('scratch/beat-grid-v2')
def fingerprint(path):
    model=onnx.load(path)
    h=hashlib.sha256()
    for tensor in sorted(model.graph.initializer,key=lambda x:x.name):
        if tensor.name.startswith('kora_eyelike_'):continue
        value=numpy_helper.to_array(tensor)
        for part in [tensor.name.encode(),str(value.dtype).encode(),str(value.shape).encode(),value.tobytes()]:h.update(part)
    return {'path':str(path),'containerSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'initializerFingerprint':h.hexdigest(),'bytes':path.stat().st_size,
      'ops':sorted({n.op_type for n in model.graph.node})}

models={}
paths={'BASE':Path('extensions/kanban-music/generated/percussion/percussion.onnx'),
 'C1':root/'weights/C1/published-web-demo.onnx','C1-legacy-not-benchmarked':root/'weights/C1/legacy-root.onnx',
 'C2':root/'weights/C2/oaf_drums.onnx','C3':root/'weights/C3/drumsep.onnx',
 'C3-compatible':root/'weights/C3/drumsep-compatible.onnx'}
for key,path in paths.items():models[key]=fingerprint(path)
assert models['BASE']['containerSha256']=='c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a'
assert models['C3']['initializerFingerprint']==models['C3-compatible']['initializerFingerprint']
historical=[]
for stem in ['drums','vocals','bass','other']:
    original=fingerprint(Path('scratch/instrument-proof')/(stem+'.onnx'))
    converted=fingerprint(Path('scratch/instrument-proof')/(stem+'-128.onnx'))
    historical.append({'component':stem,'original':original,'converted':converted,
      'sameInitializers':original['initializerFingerprint']==converted['initializerFingerprint'],
      'semanticNovelty':False})
configFiles=['extensions/kanban-music/percussion-features.js','extensions/kanban-music/percussion-classifier.js',
 'extensions/kanban-music/generated/percussion/percussion.json']
contracts={f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in configFiles}
checkpoints=json.loads((root/'checkpoint-manifest.json').read_text(encoding='utf-8'))
result={'baseRevision':'c93046ad262db21577792eed0ee61c3452525328','models':models,
 'historicalSeparatorConversions':historical,'baselineContracts':contracts,'checkpoints':checkpoints,
 'novelty':{'BASE':'Duplicate unchanged semantic detector; reuse 17 exact corpus traces and previous browser route evidence.',
 'C1':'Distinct trained frame CNN architecture and weights; documented demo configuration selected once.',
 'C2':'Distinct Magenta OAF E-GMD checkpoint vs Kora ADTOF; its ONNX conversion itself is not new technology.',
 'C3':'Distinct Hybrid Demucs drum-element separation architecture; deterministic onsets are a pipeline, not an independent Hat classifier. Compatibility derivative is identical learned weights.',
 'C4':'Distinct autoregressive Transformer, single tau-0.8 checkpoint. Identical root duplicate skipped.',
 'C5':'Distinct latent diffusion architecture, acquisition/runtime blocked; no benchmark claim.',
 'C6':'ADTOF-dependent complete pipeline; full weight equivalence to BASE unresolved, default dependency rights blocked. No accuracy/runtime result reused as if the complete wrapper had run.',
 'C7':'Conditional YOLO drum detector, supplied weight/config contract unresolved; not benchmarked.'},
 'reusePolicy':'Semantic evidence reused only with matching audio, learned weights, preprocessing and postprocessing. New input or changed pipeline stages get new runs; runtime/format changes do not create model novelty.',
 'preBenchmarkGate':'PASS: identities inspected before any quality sweep; minimal gate probes are not quality benchmark claims.'}
(root/'identity-reuse-registry.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'models':len(models),'historicalConvertedPairs':len(historical),
 'sameInitializerPairs':sum(p['sameInitializers'] for p in historical),'preBenchmarkGate':'PASS'}))
