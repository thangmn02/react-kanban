"""One fixed private inference round; no thresholds are fitted to the results."""
import argparse
import asyncio
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
import numpy as np
import onnxruntime as ort
import psutil
import soundfile as sf

ROOT=Path('scratch/beat-grid-v2').resolve()
spec=importlib.util.spec_from_file_location('beat_v2_evidence',Path(__file__).with_name('beat-v2-evidence.py'))
evidence=importlib.util.module_from_spec(spec);spec.loader.exec_module(evidence)
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def equivalent_input(executed,item):
    if executed==item['sha256']:return True
    aliases=read(ROOT/'decoded-pcm-aliases.json') if (ROOT/'decoded-pcm-aliases.json').exists() else {}
    alias=aliases.get(item['id'],{})
    return alias.get('executedContainerSha256')==executed and alias.get('canonicalContainerSha256')==item['sha256'] and alias.get('decodedPcmSha256')==item.get('decodedPcmSha256')
def baseline_bridge(kind,value):
    data=value if isinstance(value,bytes) else json.dumps(value).encode()
    result=subprocess.run(['node','scripts/beat-v2-baseline-bridge.mjs',kind],input=data,capture_output=True,check=True)
    return json.loads(result.stdout)

def instrument(lane,value):
    if lane=='BASE':return ['kick','snare','tom','hat','cymbal'][int(value)]
    if lane=='C1':return {'kick':'kick','snare':'snare','hihat':'hat'}[value]
    if lane=='C3':return value
    if lane=='C4':
        # ADT_STR uses its custom 26-class pitch vocabulary, not standard GM.
        return next((name for name,keys in {'kick':{35,36},'snare':{37,38,39,40},'hat':{42,43,44},
          'tom':{41,45,47},'cymbal':{46,48,49,51}}.items() if int(value) in keys),'other')
    return next((name for name,keys in {'kick':{35,36},'snare':{37,38,39,40},'hat':{42,44,46},
      'tom':{41,43,45,47,48,50},'cymbal':{49,51,52,53,55,57,59}}.items() if int(value) in keys),'other')

class Resources:
    def __enter__(self):
        self.process=psutil.Process();self.peak=self.process.memory_info().rss;self.stop=threading.Event()
        self.before=self.process.cpu_times();self.start=time.perf_counter()
        def sample():
            while not self.stop.wait(.025):
                total=self.process.memory_info().rss
                for child in self.process.children(recursive=True):
                    try:total+=child.memory_info().rss
                    except psutil.NoSuchProcess:pass
                self.peak=max(self.peak,total)
        self.observer=threading.Thread(target=sample,daemon=True);self.observer.start();return self
    def __exit__(self,*args):
        self.elapsed=time.perf_counter()-self.start;self.stop.set();self.observer.join();after=self.process.cpu_times()
        self.cpu=after.user+after.system-self.before.user-self.before.system
        self.peak=max(self.peak,self.process.memory_info().rss)

def load(lane):
    evidence.identity(lane)  # Verify the actual checkpoint before every load.
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1;options.log_severity_level=3
    if lane=='C1':
        source=ROOT/'sources/C1/webUI'
        assert sha(source/'drum_cnn.onnx')=='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'
        original=ort.InferenceSession
        def factory(*args,**kwargs):kwargs['sess_options']=options;return original(*args,**kwargs)
        before=Path.cwd();ort.InferenceSession=factory
        try:
            os.chdir(source);spec=importlib.util.spec_from_file_location('private_c1_published_server',source/'server.py')
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        finally:os.chdir(before);ort.InferenceSession=original
        class RecordingSession:
            def __init__(self,session):self.session=session;self.logits=[];self.cost=0
            def run(self,*args,**kwargs):
                began=time.perf_counter();outputs=self.session.run(*args,**kwargs);self.cost+=time.perf_counter()-began
                self.logits.append(outputs[0].copy());return outputs
        module.SESSION=RecordingSession(module.SESSION)
        return module
    if lane=='C4':
        import torch
        torch.set_num_threads(4)
        sys.path.insert(0,str(ROOT/'sources/C4-hub'))
        from adt_transcriber import ADTTranscriber
        model=ADTTranscriber.from_pretrained(str(ROOT/'weights/C4'),variant='setting-tau-0.8',device='cpu')
        assert model.sample_rate==24000 and model.input_sec==2.56 and not model.tokenizer.ADTOF_mapping
        return model
    path={'BASE':Path('extensions/kanban-music/generated/percussion/percussion.onnx'),
      'C2':ROOT/'weights/C2/oaf_drums.onnx','C2-separated':ROOT/'weights/C2/oaf_drums.onnx',
      'C3':ROOT/'weights/C3/drumsep-compatible.onnx'}[lane]
    if lane in ['C2','C2-separated']:path=Path(read(ROOT/'c2-output-contract-repair.json')['path'])
    return ort.InferenceSession(str(path),options,providers=['CPUExecutionProvider'])

def infer(lane,model,item,out):
    y,sr=sf.read(item['path'],dtype='float32',always_2d=True)
    assert sr==44100 and y.shape[1]==2
    raw=[];extra={};pre=0;inference=0;post=0;childCpu=0
    if lane=='BASE':
        if item.get('baselineReuse'):
            assert hashlib.sha256(y.astype('<f4').tobytes()).hexdigest()==item['baselineReuse']['decodedPcmSha256']
            prior=read(item['baselineReuse']['trace']);packet=baseline_bridge('classify',prior['activations']);events=packet['events'];childCpu+=packet['resources']['cpuSeconds']
            def comparable(e):return {k:v for k,v in e.items() if k not in ['classIndex','decisionAudioTime']}
            assert [comparable(e) for e in events]==[comparable(e) for e in prior['events']]
            extra={'reusedEvidence':item['baselineReuse'],'priorRuntimeNotCompared':True}
        else:
            began=time.perf_counter();features=baseline_bridge('features',y.astype('<f4').tobytes());pre=time.perf_counter()-began
            childCpu+=features['resources']['cpuSeconds'];frames=features['frames'];activations=[];costs=[]
            for i in range(4,len(frames),5):
                selected=frames[max(0,i-99):i+1];offset=100-len(selected);x=np.zeros((1,100,84,1),np.float32)
                x[0,offset:,:,0]=np.asarray([f['data'] for f in selected],np.float32)
                began=time.perf_counter();scores=model.run(None,{'audio':x})[0].reshape(100,5);costs.append(time.perf_counter()-began)
                for j in range(85,90):
                    if j>=offset:activations.append({'audioTime':selected[j-offset]['time'],'scores':scores[j].tolist()})
            inference=sum(costs);began=time.perf_counter();packet=baseline_bridge('classify',activations);events=packet['events'];childCpu+=packet['resources']['cpuSeconds'];post=time.perf_counter()-began
            np.savez_compressed(out.with_suffix('.npz'),scores=np.asarray([f['scores'] for f in activations]),times=np.asarray([f['audioTime'] for f in activations]))
            extra={'inferenceCalls':len(costs),'maximumStepSeconds':max(costs),'futureContextSeconds':.1}
        for e in events:raw.append({'time':e['audioTime'],'rawClass':e['classIndex'],'value':e['value'],'confidence':e['confidence']})
    elif lane=='C1':
        from starlette.datastructures import UploadFile
        model.SESSION.logits=[];model.SESSION.cost=0;began=time.perf_counter()
        with open(item['path'],'rb') as file:result=asyncio.run(model.transcribe(UploadFile(file=file,filename=item['id']+'.wav')))
        total=time.perf_counter()-began;inference=model.SESSION.cost;pre=total-inference
        logits=np.concatenate(model.SESSION.logits);np.savez_compressed(out.with_suffix('.npz'),logits=logits)
        for name,times in result['onsets'].items():
            for t in times:raw.append({'time':t,'rawClass':name})
        extra={'publishedResult':result,'necessaryContext':'global maximum dB normalization plus centered STFT/deltas/context; not proven causal'}
    elif lane in ['C2','C2-separated']:
        began=time.perf_counter();mono=y.mean(axis=1)[None];pre=time.perf_counter()-began;began=time.perf_counter()
        onset,velocity=model.run(None,{'waveform':mono});inference=time.perf_counter()-began;onset=onset[0];velocity=velocity[0]
        original=ROOT/'published-oaf-invalid-selector/results'/lane/(item['id']+'.npz')
        parity={'status':'new control has no earlier selected-column evidence'}
        if original.exists():
            prior=np.load(original);unchanged=[0,1,2,4,5,6,7]
            differences={name:float(np.max(np.abs(current[:,unchanged]-prior[name][:,unchanged])))
              for name,current in [('onset',onset),('velocity',velocity)]}
            assert all(value<=1e-6 for value in differences.values()),('Unchanged OAF outputs differ',item['id'],differences)
            parity={'status':'PASS: seven unchanged columns','originalRawSha256':sha(original),'maximumAbsoluteDifferences':differences}
        np.savez_compressed(out.with_suffix('.npz'),onset=onset,velocity=velocity)
        began=time.perf_counter()
        # Conversion author's decode: strongest frame in each continuous >.5 run.
        for col,pitch in enumerate([36,38,48,46,51,53,49,75]):
            active=np.flatnonzero(onset[:,col]>.5)
            for group in np.split(active,np.flatnonzero(np.diff(active)>1)+1):
                if not len(group):continue
                best=int(group[np.argmax(onset[group,col])])
                raw.append({'time':best/100,'rawClass':pitch,'confidence':float(onset[best,col]),
                  'velocity':max(1,int(np.clip(velocity[best,col],0,1)*127))})
        post=time.perf_counter()-began;extra={'futureContext':'bidirectional LSTM across input clip','threshold':.5,
          'selectorRepair':read(ROOT/'c2-output-contract-repair.json'),'unchangedOutputParity':parity,
          'hatIdentity':'Magenta trained HH/Tambourine/Maracas group at raw pitch46; no independent open/closed subtype identity'}
    elif lane=='C4':
        import torch
        began=time.perf_counter();wave=model._prepare_waveform(torch.from_numpy(y.mean(1)),sr);pre=time.perf_counter()-began
        began=time.perf_counter();notes=model._transcribe_waveform(wave,batch_size=1);inference=time.perf_counter()-began
        for onset,offset,pitch,velocity in notes.tolist():raw.append({'time':onset,'offset':offset,'rawClass':int(pitch),'velocity':velocity})
        extra={'officialChunkSeconds':2.56,'executionBatchSize':1,'outputVocabulary':'ADT_STR custom 26-class MIDI keys; retain original values'}
    elif lane=='C3':
        import torch
        import librosa
        from types import SimpleNamespace
        from demucs.hdemucs import HDemucs
        torch.set_num_threads(4)
        assert len(y)<=1764000
        began=time.perf_counter();left=(1764000-len(y))//2;wave=torch.from_numpy(np.pad(y.T,((0,0),(left,1764000-len(y)-left))))[None]
        adapter=SimpleNamespace(hop_length=1024,nfft=4096,hybrid=True,hybrid_old=False,cac=True,wiener_iters=0,training=False)
        z=HDemucs._spec(adapter,wave);mag=HDemucs._magnitude(adapter,z);pre=time.perf_counter()-began
        began=time.perf_counter();freq,temporal=model.run(None,{'waveform':wave.numpy(),'magnitude':mag.numpy()});inference=time.perf_counter()-began
        began=time.perf_counter();spec=HDemucs._mask(adapter,z,torch.from_numpy(freq));stems=HDemucs._ispec(adapter,spec,1764000)+torch.from_numpy(temporal)
        stems=stems[0,:,:,left:left+len(y)].numpy();np.savez_compressed(out.with_suffix('.npz'),stems=stems)
        for index,name in enumerate(['kick','snare','cymbal','tom']):
            mono=stems[index].mean(0)
            if float(np.max(np.abs(mono)))<1e-5:continue
            times=librosa.onset.onset_detect(y=mono,sr=sr,hop_length=441,units='time',backtrack=False)
            raw.extend({'time':float(t),'rawClass':name} for t in times)
        post=time.perf_counter()-began
        extra={'fixedContextSeconds':40,'paddingLeftSamples':left,'onsetExtractor':'librosa defaults, hop441, backtrack false, fixed absolute peak floor1e-5; no fitted thresholds',
          'hatIdentity':'UNSUPPORTED: Cymbals output is not independently identified Hi-Hat','stemClasses':['kick','snare','cymbal','tom']}
    normalized=[{**e,'instrument':instrument(lane,e['rawClass']),
      'displayRow':'hat' if instrument(lane,e['rawClass']) in ['hat','cymbal'] else instrument(lane,e['rawClass'])} for e in raw]
    return {'rawEvents':raw,'events':normalized,'preprocessingSeconds':pre,'inferenceSeconds':inference,'postprocessingSeconds':post,'childCpuSeconds':childCpu,**extra}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--lane',required=True,choices=['BASE','C1','C2','C2-separated','C3','C4']);args=parser.parse_args()
    manifest=read(ROOT/'corpus-manifest.json');registry=read(ROOT/'identity-reuse-registry.json');assert registry['preBenchmarkGate'].startswith('PASS')
    assert sha(ROOT/'corpus-manifest.json')==read(ROOT/'round-corpus-freeze.json')['manifestSha256']
    lane=args.lane;outdir=ROOT/'results'/lane;outdir.mkdir(parents=True,exist_ok=True)
    contract=evidence.identity(lane)
    modelStart=time.perf_counter();model=load(lane);cold=time.perf_counter()-modelStart
    items=manifest['items']
    for original in items:
        item=dict(original);separator=None
        if lane=='C2-separated' and item['domain']!='full-mix':continue
        if lane in ['C2-separated','C3'] and item['domain']=='full-mix':
            separator=read(ROOT/'first-separator-cache'/(item['id']+'.json'))
            assert separator['evidenceIdentity']==evidence.identity('first-separator')
            assert sha(separator['path'])==separator['sha256']
            assert equivalent_input(separator['sourceSha256'],item)
            item.update(path=separator['path'],sha256=separator['sha256'],domain='separated-drum-stem')
        out=outdir/(item['id']+'.json')
        if out.exists():
            prior=read(out);assert prior['lane']==lane
            evidence.validate(prior,item,contract,out.with_suffix('.npz') if prior.get('rawOutputSha256') else None)
            print(json.dumps({'lane':lane,'id':item['id'],'reusedExistingResult':True}),flush=True)
            continue
        assert sha(item['path'])==item['sha256']
        with Resources() as resources:result=infer(lane,model,item,out)
        cpu=resources.cpu+result.get('childCpuSeconds',0)
        overhead=separator['overheadMeasurement'] if separator else None
        total=resources.elapsed+(separator['separationSeconds']+overhead['preparationSeconds']+overhead['outputSerializationSeconds'] if separator else 0)
        fullCpu=cpu+(separator['cpuSeconds']+overhead['cpuSeconds'] if separator else 0)
        record={'lane':lane,'id':item['id'],'inputSha256':item['sha256'],'originalInputSha256':original['sha256'],
          'evidenceIdentity':contract,'rawOutputSha256':sha(out.with_suffix('.npz')) if out.with_suffix('.npz').exists() else None,
          'rawEventsSha256':evidence.digest(result['rawEvents']),
          'reusedTraceSha256':sha(result['reusedEvidence']['trace']) if result.get('reusedEvidence') else None,
          'costScope':'Measured stage sum; first-separator preparation/serialization measured separately without repeating its neural execution. Evaluation raw-output recording included.',
          'originalDomain':original['domain'],'executedDomain':item['domain'],'modelMode':'OFFLINE EVALUATION; no browser streaming qualification',
          'coldLoadSeconds':cold,'fullPipelineColdLoadSeconds':cold+(separator['coldLoadSeconds'] if separator else 0),
          'residentPeakBytes':max(resources.peak,separator['residentPeakBytes'] if separator else 0),'cpuSeconds':fullCpu,
          'cpuHostUtilizationPercent':fullCpu/total/os.cpu_count()*100,
          'elapsedSeconds':resources.elapsed,'fullPipelineSeconds':total,
          'rtf':total/original['duration'],
          'firstSeparator':separator,'gpuExecution':False,'cpuThreads':4,'cpuProvider':'CPUExecutionProvider/Torch CPU',**result}
        if result.get('priorRuntimeNotCompared'):
            record['runtimeStatus']='NOT COMPARABLE: prior activations replayed for correctness only'
            for key in ['coldLoadSeconds','fullPipelineColdLoadSeconds','residentPeakBytes','cpuSeconds','cpuHostUtilizationPercent',
              'elapsedSeconds','fullPipelineSeconds','rtf','preprocessingSeconds','inferenceSeconds','postprocessingSeconds','childCpuSeconds']:
                record[key]=None
        out.write_text(json.dumps(record),encoding='utf-8')
        print(json.dumps({'lane':lane,'id':item['id'],'events':len(result['events']),'elapsed':record['elapsedSeconds'],'rtf':record['rtf'],'reused':bool(result.get('reusedEvidence'))}),flush=True)

if __name__=='__main__':main()
