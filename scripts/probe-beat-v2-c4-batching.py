"""Bounded execution-layout parity check, not a new detector or quality sweep."""
import importlib.util,json,time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
spec=importlib.util.spec_from_file_location('runner',Path(__file__).with_name('run-beat-v2-inference.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
root=r.ROOT;manifest=r.read(root/'corpus-manifest.json');contract=r.evidence.identity('C4')
old=r.read(root/'pre-validation-guard-scripts/contracts.json')['C4']
model=r.load('C4');results=[]
for itemId in ['weak-strong-hat','trap']:
    item=next(i for i in manifest['items'] if i['id']==itemId)
    prior=r.read(root/'results/C4'/(itemId+'.json'));assert prior['evidenceIdentity']==old
    assert r.sha(item['path'])==item['sha256']
    y,sr=sf.read(item['path'],dtype='float32',always_2d=True)
    wave=model._prepare_waveform(torch.from_numpy(y.mean(1)),sr)
    start=time.perf_counter();notes=model._transcribe_waveform(wave,batch_size=1).numpy();elapsed=time.perf_counter()-start
    expected=np.asarray([[e['time'],e['offset'],e['rawClass'],e['velocity']] for e in prior['rawEvents']],dtype=notes.dtype)
    np.testing.assert_array_equal(notes,expected)
    result={'id':itemId,'exactOrderedNoteParity':True,'notes':len(notes),'inputSha256':item['sha256'],
      'originalRecordSha256':r.sha(root/'results/C4'/(itemId+'.json')),
      'batch8Seconds':prior['inferenceSeconds'],'batch1Seconds':elapsed,'chunks':int(np.ceil(len(y)/(sr*2.56)))}
    results.append(result);print(json.dumps(result),flush=True)
proof={'status':'PASS','originalContract':old,'currentContractFingerprint':contract['fingerprint'],
  'sourceIndependenceReview':'Official chunker, eval-mode encoder/decoder attention, LayerNorm, greedy argmax and EOS operate independently per row; only CPU numerical kernel shape can change rounding.',
  'scope':'Exact raw-note parity on two completed six-chunk inputs including one hard decoder case. No completed eight-chunk batch was available; unprobed completed inputs were not rerun.',
  'preservedModelSettings':{'checkpoint':'tau-0.8','sampleRate':24000,'chunkSeconds':2.56,'maxLength':512,'greedy':True,'cpuThreads':4},
  'executionChange':{'fromBatch':8,'toBatch':1,'authorSupportedArgument':True,'semanticNovelty':False},'probes':results}
(root/'c4-batching-parity.json').write_text(json.dumps(proof,indent=2))
