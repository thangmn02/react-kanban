"""Prove the runtime adapter matches the development-frozen offline variant."""
import importlib.util
import json
import subprocess

spec = importlib.util.spec_from_file_location('early_comparison', 'scripts/compare-early-percussion-decisions.py')
d2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d2)
manifest, admission = d2.admit()
selection = d2.evidence.read(d2.OUT / 'selection.json')
assert admission == selection['admission']
items = [{'id': i['id'], 'frames': d2.activation_frames(admission['bindings'][i['id']])} for i in manifest['items']]
regressions = d2.evidence.read(d2.OUT / 'regressions.json')
for case in regressions['songRegressions']:
    folder = d2.Path('scratch/acoustic-visual-lab/full-songs') / case['sourceSha256']
    record = d2.evidence.read(folder / 'A.json')
    raw_path = folder / record['rawFile']
    assert d2.evidence.sha(raw_path) == case['rawSha256']
    raw = d2.evidence.read(raw_path)
    items.append({'id': case['case'], 'frames': [{'audioTime': t, 'scores': s} for t, s in zip(raw['times'], raw['scores'])]})

program = r"""
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EarlyPercussionClassifier} from './extensions/kanban-music/early-percussion-classifier.js';
import {loadVariant} from './scripts/replay-early-percussion-decisions.mjs';
const input=JSON.parse(readFileSync(0,'utf8'));
const config=JSON.parse(readFileSync('extensions/kanban-music/generated/percussion/percussion.json'));
const variant=await loadVariant(input.selected),runs=[];
for(const item of input.items){
  const expected=new variant.Classifier(config.thresholds,{onsetGuided:true,diagnostics:true});
  const actual=new EarlyPercussionClassifier(config.thresholds,{diagnostics:true});
  let events=0;
  for(const [index,frame] of item.frames.entries()){
    const a=expected.push(frame.scores,frame.audioTime),b=actual.push(frame.scores,frame.audioTime);
    const key=e=>[e.classIndex,e.audioTime,e.confidence,e.value,e.classMargin];
    assert.deepEqual(b.events.map(key),a.events.map(key),item.id+' frame '+index);
    assert.equal(b.outcome,a.outcome);
    events+=b.events.length;
  }
  runs.push({id:item.id,frames:item.frames.length,events,exactDecisionFrameParity:true});
}
process.stdout.write(JSON.stringify({runs}));
"""
result = subprocess.run(['node', '--input-type=module', '-e', program],
                        input=json.dumps({'selected': selection['selected'], 'items': items}).encode(),
                        capture_output=True, check=True)
proof = json.loads(result.stdout)
proof.update(selectionSha256=d2.evidence.sha(d2.OUT / 'selection.json'),
             runtimeAdapterSha256=d2.evidence.sha('extensions/kanban-music/early-percussion-classifier.js'),
             neuralInferenceRun=False, status='PASS')
d2.write(d2.OUT / 'runtime-adapter-parity.json', proof)
print(json.dumps({'status': 'PASS', 'streams': len(proof['runs']),
                  'frames': sum(r['frames'] for r in proof['runs']), 'neuralInferenceRun': False}))
