"""Run the first separator once per exact full-mix input; share valid evidence."""
import hashlib
import importlib.util
import json
import os
import random
import threading
import time
from pathlib import Path
import numpy as np
import psutil
import soundfile as sf
import torch
from safetensors import safe_open
from demucs.hf import load_safetensors_model
from demucs.apply import apply_model

root=Path('scratch/beat-grid-v2')
spec=importlib.util.spec_from_file_location('beat_v2_evidence',Path(__file__).with_name('beat-v2-evidence.py'))
evidence=importlib.util.module_from_spec(spec);spec.loader.exec_module(evidence)
contract=evidence.identity('first-separator')
manifest=json.loads((root/'corpus-manifest.json').read_text(encoding='utf-8'))
aliases=json.loads((root/'decoded-pcm-aliases.json').read_text()) if (root/'decoded-pcm-aliases.json').exists() else {}
assert json.loads((root/'identity-reuse-registry.json').read_text())['preBenchmarkGate'].startswith('PASS')
modelPath=root/'weights/first-separator/955717e8.safetensors'
modelSha=hashlib.sha256(modelPath.read_bytes()).hexdigest()
assert modelSha=='d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd'
with safe_open(str(modelPath),framework='pt') as f:
    assert f.metadata()['klass']=='demucs.htdemucs.HTDemucs'
    assert all(v.get('_type')=='fraction' for v in json.loads(f.metadata()['kwargs']).values() if isinstance(v,dict))
torch.set_num_threads(4)
began=time.perf_counter()
model=load_safetensors_model(modelPath).eval()
cold=time.perf_counter()-began
cache=root/'first-separator-cache'
cache.mkdir(exist_ok=True)
options={'shifts':1,'split':True,'overlap':.25,'cpuThreads':4,'normalization':'official CLI mono mean/std; deterministic input-hash RNG seed'}
pipelineSha=hashlib.sha256(json.dumps({'model':modelSha,'options':options},sort_keys=True).encode()).hexdigest()
process=psutil.Process()
for item in manifest['items']:
    if item['domain']!='full-mix':continue
    recordPath=cache/(item['id']+'.json')
    if recordPath.exists():
        prior=json.loads(recordPath.read_text())
        alias=aliases.get(item['id'],{})
        assert (prior['sourceSha256']==item['sha256'] or
          alias.get('executedContainerSha256')==prior['sourceSha256'] and alias.get('canonicalContainerSha256')==item['sha256']
          and alias.get('decodedPcmSha256')==item['decodedPcmSha256']) and prior['evidenceIdentity']==contract
        assert prior['realizedSeed']==int(prior['seedIdentitySha256'][:8],16)
        assert hashlib.sha256(Path(prior['path']).read_bytes()).hexdigest()==prior['sha256']
        print(json.dumps({'id':item['id'],'reused':True}),flush=True)
        continue
    source=Path(item['path'])
    assert hashlib.sha256(source.read_bytes()).hexdigest()==item['sha256']
    seed=int(item['decodedPcmSha256'][:8],16)
    random.seed(seed);torch.manual_seed(seed)
    y,sr=sf.read(source,dtype='float32',always_2d=True)
    assert sr==44100 and y.shape[1]==2
    wave=torch.from_numpy(y.T.copy())
    ref=wave.mean(0);std=ref.std();mean=ref.mean()
    # Silence does not require arbitrary gain amplification.
    normalized=(wave-mean)/std if float(std)>1e-8 else wave-mean
    peak=[process.memory_info().rss];done=threading.Event()
    def sample():
        while not done.wait(.025):peak[0]=max(peak[0],process.memory_info().rss)
    observer=threading.Thread(target=sample,daemon=True);observer.start()
    cpu0=process.cpu_times();start=time.perf_counter()
    with torch.no_grad():stems=apply_model(model,normalized[None],device='cpu',shifts=1,split=True,overlap=.25,progress=False)[0]
    stems=stems*std+mean if float(std)>1e-8 else stems+mean
    elapsed=time.perf_counter()-start;done.set();observer.join()
    cpu1=process.cpu_times();drums=stems[model.sources.index('drums')].T.numpy()
    target=cache/(item['id']+'-drums.wav')
    sf.write(target,drums,44100,subtype='FLOAT')
    record={'id':item['id'],'sourceSha256':item['sha256'],'pipelineSha256':pipelineSha,'modelSha256':modelSha,
      'evidenceIdentity':contract,'realizedSeed':seed,'seedIdentitySha256':item['decodedPcmSha256'],
      'seedPolicy':'decoded PCM SHA; stable across container metadata changes',
      'path':str(target.resolve()),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'options':options,
      'coldLoadSeconds':cold,'separationSeconds':elapsed,'inputSeconds':len(y)/sr,'rtf':elapsed/(len(y)/sr),
      'residentPeakBytes':max(peak[0],process.memory_info().rss),'cpuSeconds':cpu1.user+cpu1.system-cpu0.user-cpu0.system,
      'cpuHostUtilizationPercent':(cpu1.user+cpu1.system-cpu0.user-cpu0.system)/elapsed/os.cpu_count()*100,
      'executionProvider':'CPU','outputClasses':model.sources,'purpose':'model-predicted stem; not an independent reference'}
    recordPath.write_text(json.dumps(record,indent=2))
    print(json.dumps({k:record[k] for k in ['id','separationSeconds','rtf','residentPeakBytes']}),flush=True)
