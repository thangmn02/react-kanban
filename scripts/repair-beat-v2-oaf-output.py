"""Correct a published nonlearned output selector; never call this new model technology."""
import ast,hashlib,json
from pathlib import Path
import numpy as np
import onnx
from onnx import numpy_helper
root=Path('scratch/beat-grid-v2');source=root/'weights/C2/oaf_drums.onnx'
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert sha(source)=='23d4b05ce7e9715bdb4396823d68bc886e8a958fa9f6266c0f7132b78098b521'
mapping=root/'sources/C2-conversion/pinned-drum_mappings.py'
tree=ast.parse(mapping.read_text())
assignment=next(n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='HIT_MAPS' for t in n.targets))
pitches=[group[0] for group in ast.literal_eval(assignment.value)['8-hit']]
assert pitches==[36,38,48,46,51,53,49,75]
model=onnx.load(source);before={t.name:t.SerializeToString() for t in model.graph.initializer}
columns=next(t for t in model.graph.initializer if t.name=='columns')
np.testing.assert_array_equal(numpy_helper.to_array(columns),[15,17,27,21,30,32,28,54])
columns.CopyFrom(numpy_helper.from_array(np.asarray(pitches,dtype=np.int64)-21,'columns'))
assert all(before[t.name]==t.SerializeToString() for t in model.graph.initializer if t.name!='columns')
for prop in model.metadata_props:
    if prop.key=='pitches':prop.value=','.join(map(str,pitches))
onnx.checker.check_model(model);target=source.with_name('oaf-drums-corrected-selector.onnx');onnx.save(model,target)
record={'sourceSha256':sha(source),'derivedSha256':sha(target),'path':str(target.resolve()),
  'magentaContract':json.loads((root/'c2-magenta-class-contract.json').read_text()),
  'mappingSha256':sha(mapping),'originalSelectedPitches':[36,38,48,42,51,53,49,75],'correctedSelectedPitches':pitches,
  'changedInitializer':'columns (nonlearned output index only)','learnedInitializerBytesUnchanged':True,
  'semanticNovelty':False,'reason':'Pinned original 8-hit mapping uses pitch46 for HH/Tambourine/Maracas; published conversion incorrectly selected untrained pitch42.',
  'repeatReason':'Saved raw outputs contain only the selected eight columns and omit pitch46; missing neural intermediates prevent recovering that class without executing the prefix. Preserve and compare the seven unchanged columns.'}
(root/'c2-output-contract-repair.json').write_text(json.dumps(record,indent=2))
print(json.dumps(record))
