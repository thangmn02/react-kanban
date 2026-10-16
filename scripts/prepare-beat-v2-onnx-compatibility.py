"""Lower unsupported EyeLike to equivalent primitive ops; learned weights unchanged."""
import hashlib
import json
from pathlib import Path
import numpy as np
import onnx
from onnx import helper, numpy_helper

root = Path('scratch/beat-grid-v2')
source = root / 'weights/C3/drumsep.onnx'
model = onnx.load(source)
original = {t.name: t.SerializeToString() for t in model.graph.initializer}
nodes = []
lowered = 0
for node in model.graph.node:
    if node.op_type != 'EyeLike':
        nodes.append(node)
        continue
    attr = {a.name: helper.get_attribute_value(a) for a in node.attribute}
    prefix = f'kora_eyelike_{lowered}_'
    dtype, diagonal = attr.get('dtype', onnx.TensorProto.FLOAT), attr.get('k', 0)
    for key, value in [('zero', 0), ('one', 1), ('axis0', [0]), ('axis1', [1]), ('diagonal', diagonal)]:
        model.graph.initializer.append(numpy_helper.from_array(np.asarray(value, dtype=np.int64), prefix+key))
    def add(op, inputs, output, **kwargs):
        nodes.append(helper.make_node(op, [x[1:] if x.startswith('@') else prefix+x for x in inputs], [prefix+output], **kwargs))
    add('Shape', ['@'+node.input[0]], 'shape')
    add('Gather', ['shape', 'zero'], 'rows')
    add('Gather', ['shape', 'one'], 'cols')
    add('Range', ['zero', 'rows', 'one'], 'r')
    add('Range', ['zero', 'cols', 'one'], 'c')
    add('Unsqueeze', ['r', 'axis1'], 'rr')
    add('Unsqueeze', ['c', 'axis0'], 'cc')
    add('Add', ['rr', 'diagonal'], 'shifted')
    add('Equal', ['shifted', 'cc'], 'eye')
    nodes.append(helper.make_node('Cast', [prefix+'eye'], list(node.output), to=dtype))
    lowered += 1
assert lowered > 0
del model.graph.node[:]
model.graph.node.extend(nodes)
assert all(original[t.name] == t.SerializeToString() for t in model.graph.initializer if t.name in original)
onnx.checker.check_model(model)
target = source.with_name('drumsep-compatible.onnx')
onnx.save(model, target)
(root/'onnx-compatibility.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'derivedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'loweredEyeLikeNodes':lowered,
 'learnedInitializerBytesUnchanged':True,'semanticNovelty':False},indent=2))
print(f'Lowered {lowered} EyeLike nodes without modifying learned initializer bytes.')
