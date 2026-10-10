"""One reproducible private past-only student; pseudo labels are NOT ground truth."""
import argparse
import hashlib
import json
from pathlib import Path
import time
import importlib.util
import numpy as np
import torch
from torch import nn
import torch.nn.functional as F
spec = importlib.util.spec_from_file_location('evaluation', Path(__file__).with_name('evaluate-learned-percussion.py'))
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)
audio, LearnedPercussion = evaluation.audio, evaluation.LearnedPercussion


class CausalPercussion(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([nn.Conv1d(84, 48, 5), nn.Conv1d(48, 48, 5, dilation=2),
                                    nn.Conv1d(48, 48, 5, dilation=4)])
        self.output = nn.Conv1d(48, 6, 1)

    def logits(self, audio):
        value = audio[..., 0].transpose(1, 2)
        for layer in self.layers:
            value = F.relu(layer(F.pad(value, (4 * layer.dilation[0], 0))))
        return self.output(value).transpose(1, 2)

    def forward(self, audio):
        return torch.sigmoid(self.logits(audio))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs', required=True)
    parser.add_argument('--teacher', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--epochs', type=int, default=20)
    args = parser.parse_args()
    torch.manual_seed(731); np.random.seed(731); torch.set_num_threads(2)
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    cases = json.loads(Path(args.inputs).read_text(encoding='utf-8-sig'))
    # Family-disjoint split is fixed BEFORE training. Never optimize on holdouts.
    calibration = [c for c in cases if c.get('family') in ('lee_hi_hskt', 'chan_ai_remix', 'chinese_pop')]
    processor = LearnedPercussion(onnx_path=Path(args.teacher) / 'percussion.onnx')
    prepared, provenance = [], []
    began = time.perf_counter()
    for case in calibration:
        features = processor.features(audio(case)).astype(np.float32)
        scores = np.load(Path('src-tauri/target/percussion-latency/batch-check') / (case['track'] + '-5-10-scores.npy'))
        negative = case.get('role') in ('A', 'B', 'C', 'F')
        targets = np.zeros((len(features), 6), dtype=np.float32)
        if not negative:
            # Teacher activations are uncalibrated: .35 may be a valid Hat peak.
            # Train identity/abstention on its accepted pseudo attacks, not on
            # 1-max(raw activation), which incorrectly labels such hits absent.
            for event in evaluation.percussion_events(scores, len(features)/100):
                column = {'kick':0,'snare':1,'hat':3}[event['type']]
                frame = round(event['time']*100)
                for offset, value in ((-1,.6),(0,1),(1,.6)):
                    if 0 <= frame+offset < len(features): targets[frame+offset,column] = value
        targets[:, 5] = 1 - targets[:, [0, 1, 3, 4]].max(axis=1)
        for start in range(0, len(features)-100, 50):
            prepared.append((features[start:start+100], targets[start:start+100]))
        provenance.append({'input': case['track'], 'role': case['role'], 'targetOrigin':
                           'isolated-nonpercussion-control' if negative else 'ADTOF-pseudo-label'})
    x = torch.from_numpy(np.stack([a for a, _ in prepared]))
    y = torch.from_numpy(np.stack([b for _, b in prepared]))
    model = CausalPercussion().train()
    optimizer = torch.optim.Adam(model.parameters(), lr=.002)
    losses = []
    for epoch in range(args.epochs):
        total = 0
        for indices in torch.randperm(len(x)).split(32):
            prediction = model.logits(x[indices])[:, 29:]
            target = y[indices, 29:]
            # Preserve narrow teacher peaks rather than using total event counts.
            loss = F.binary_cross_entropy_with_logits(prediction, target, weight=1 + 20*target)
            optimizer.zero_grad(); loss.backward(); optimizer.step(); total += float(loss)
        losses.append(total)
        print(json.dumps({'epoch': epoch+1, 'loss': total}), flush=True)
    model.eval()
    example = x[:1]
    with torch.inference_mode():
        initial = model(example).numpy()
        changed = example.clone(); changed[:, 60:] = torch.rand_like(changed[:, 60:]) * 10
        independence = float(np.max(np.abs(initial[:, :60]-model(changed).numpy()[:, :60])))
    if independence != 0: raise RuntimeError('Model reads future features')
    torch.onnx.export(model, example, str(output/'percussion.onnx'), input_names=['audio'], output_names=['scores'],
                      opset_version=17, dynamic_axes={'audio': {0:'batch',1:'frames'}, 'scores': {0:'batch',1:'frames'}})
    import onnxruntime as ort
    session = ort.InferenceSession(str(output/'percussion.onnx'), providers=['CPUExecutionProvider'])
    parity = float(np.max(np.abs(initial-session.run(None, {'audio':example.numpy()})[0])))
    config = json.loads((Path(args.teacher)/'percussion.json').read_text())
    config.update({'stepFrames':2, 'rightContext':0, 'scoreClasses':6, 'classifier':'causal',
                   'weightsSource':'private-causal-distillation', 'sha256':hashlib.sha256((output/'percussion.onnx').read_bytes()).hexdigest()})
    (output/'percussion.json').write_text(json.dumps(config))
    (output/'training.json').write_text(json.dumps({'seed':731, 'epochs':args.epochs, 'losses':losses,
        'parameters':sum(p.numel() for p in model.parameters()), 'featureLookaheadMs':1024/44100*1000,
        'modelLookaheadMs':0, 'causalityMaxError':independence, 'onnxMaxError':parity,
        'seconds':time.perf_counter()-began, 'calibration':provenance,
        'holdoutFamilies':['nujabes','hysteria','voodoo_people','levels','MONO','Bich Phuong'],
        'limitations':['pseudo labels are not independent references','ADTOF derivative commercial rights unresolved']}, indent=2))


if __name__ == '__main__':
    main()
