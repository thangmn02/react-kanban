"""Trace frozen ONNX tensors to a pinned upstream checkpoint; never run audio."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper
import torch

parser = argparse.ArgumentParser()
parser.add_argument('--checkpoint', required=True)
parser.add_argument('--model', default='extensions/kanban-music/generated/percussion/percussion.onnx')
parser.add_argument('--output', required=True)
args = parser.parse_args()
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert digest(args.checkpoint) == '1bc986e596ec47ba0b44916f87cd4a39f0b2bec23596df3fb5d0e87749217320', 'Pinned upstream checkpoint differs.'
assert digest(args.model) == 'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a', 'Frozen ONNX model differs.'
checkpoint = torch.load(args.checkpoint, map_location='cpu', weights_only=True)['model_weights']
model = onnx.load(args.model)
used = set()
proof = []


def tensor(name):
    used.add(name)
    return checkpoint[name].to(dtype=torch.float32).numpy()


def reorder_gates(value):
    # PyTorch packs reset/update/new; ONNX packs update/reset/new.
    reset, update, new = np.split(value, 3, axis=0)
    return np.concatenate([update, reset, new], axis=0)


expected = {}
for index, suffix in enumerate([615, 660, 705]):
    prefix = f'gru_layers.{index}.'
    weights, recurrence, biases = [], [], []
    for direction in ['', '_reverse']:
        weights.append(reorder_gates(tensor(prefix + 'weight_ih_l0' + direction)))
        recurrence.append(reorder_gates(tensor(prefix + 'weight_hh_l0' + direction)))
        biases.append(np.concatenate([
            reorder_gates(tensor(prefix + 'bias_ih_l0' + direction)),
            reorder_gates(tensor(prefix + 'bias_hh_l0' + direction)),
        ]))
    expected[f'onnx::GRU_{suffix}'] = np.stack(biases)
    expected[f'onnx::GRU_{suffix + 1}'] = np.stack(weights)
    expected[f'onnx::GRU_{suffix + 2}'] = np.stack(recurrence)
expected['onnx::MatMul_708'] = tensor('output_layer.weight').T
for initializer in model.graph.initializer:
    actual = numpy_helper.to_array(initializer)
    source = expected[initializer.name] if initializer.name in expected else tensor(initializer.name)
    assert actual.shape == source.shape and actual.dtype == source.dtype, 'Model tensor representation differs.'
    assert np.array_equal(actual, source), 'Frozen tensor differs from the pinned checkpoint.'
    proof.append({'initializer': initializer.name, 'shape': list(actual.shape), 'sha256': hashlib.sha256(actual.tobytes()).hexdigest(), 'exactFloat32Match': True})
assert used == set(checkpoint), 'Unaccounted checkpoint tensors remain.'
assert len(proof) == 35, 'Unexpected frozen initializer inventory.'
result = {
    'status': 'PASS',
    'upstreamRepository': 'https://github.com/xavriley/ADTOF-pytorch',
    'upstreamCommit': '85c192e78f716ea0b111cc8a5ee4a8f6a3a4f8a9',
    'checkpointPath': 'data/adtof_frame_rnn_pytorch_weights.pth',
    'checkpointSha256': digest(args.checkpoint),
    'modelSha256': digest(args.model),
    'modelProducer': model.producer_name,
    'modelProducerVersion': model.producer_version,
    'checkpointTensors': len(checkpoint),
    'initializers': proof,
    'transformations': ['float64 checkpoint to float32 ONNX', 'GRU reset/update gate packing reordered to ONNX update/reset', 'bidirectional GRU tensors stacked', 'output matrix transposed'],
    'allWeightsAccountedFor': True,
    'audioInferencePerformed': False,
    'modelChanged': False,
    'originalExportScriptRecovered': False,
    'licenseClearanceClaimed': False,
}
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('x', encoding='utf-8') as handle:
    json.dump(result, handle, indent=2)
print(json.dumps({'status': 'PASS', 'initializers': len(proof), 'checkpointTensors': len(checkpoint), 'exactTensorMatches': True, 'modelChanged': False, 'audioInferencePerformed': False}))
