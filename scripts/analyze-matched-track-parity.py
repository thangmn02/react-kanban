"""Controlled source audit: sampled PCM alignment, same-feature CPU/WASM parity, event stages."""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
import onnxruntime as ort
import soundfile as sf
from scipy.signal import correlate

root=Path('scratch/matched-track-quality-gap')
run=Path(sys.argv[1])
data=json.loads((run/'controlled-diagnostics.json').read_text())
assert not data['replacements'], 'Do not merge capture owners'
features=sorted(data['features'],key=lambda b:b['times'][0])
times=np.asarray([t for b in features for t in b['times']])
x=np.asarray([b['data'][i*84:(i+1)*84] for b in features for i in range(len(b['times']))],np.float32)
assert np.max(abs(np.diff(times)-.01))<1e-6
blocks={b['startTime']:b for f in features for b in f.get('pcmAudit',[])}
blocks=[blocks[t] for t in sorted(blocks)]
captured=np.concatenate([np.asarray(b['channels'],np.float32).T for b in blocks])
mono=captured.astype(np.float64).mean(1).astype(np.float32)
identity=json.loads((root/'source-identity.json').read_text())
canonical_path=Path(identity['retainedOriginal']).parent/'canonical.wav'
y,sr=sf.read(canonical_path,dtype='float32',always_2d=True)
reference=y.astype(np.float64).mean(1).astype(np.float32)
probe_start=sr
probe=mono[probe_start:probe_start+sr]
assert len(probe)==sr
search=reference[:sr*15].astype(np.float64)
numerator=correlate(search,probe.astype(np.float64),mode='valid',method='fft')
energy=np.concatenate(([0.],np.cumsum(search**2)))
denominator=np.sqrt(np.maximum(energy[len(probe):]-energy[:-len(probe)],1e-30)*np.sum(probe.astype(np.float64)**2))
normalized=numerator/denominator
position=int(np.argmax(normalized));correlation=float(normalized[position]);origin=position-probe_start
assert origin>=0 and correlation>.98, ('Source alignment not established',origin,correlation)
common=min(len(mono),len(reference)-origin)
left=reference[origin:origin+common].astype(np.float64);right=mono[:common].astype(np.float64)
gain=float(np.dot(left,right)/np.dot(left,left));residual=right-gain*left
pcm={'capturedChannels':captured.shape[1],'sampleRate':sr,'samples':common,'captureStartAudioTime':blocks[0]['startTime'],
 'canonicalOriginSample':origin,'sourceOriginSeconds':origin/sr,'probeCorrelation':correlation,
 'sampleExact':bool(np.array_equal(left,right)),'fittedGain':gain,'residualRms':float(np.sqrt(np.mean(residual**2))),
 'relativeResidualRms':float(np.sqrt(np.mean(residual**2)/np.mean(right**2))),
 'scope':'Integer-sample mono correlation on bounded local captured PCM. No provider PCM comparison; alignment is analytical only, never an event timestamp correction.'}
actual={round(f['audioTime'],8):f['scores'] for f in data['frames']}
options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1
session=ort.InferenceSession('extensions/kanban-music/generated/percussion/percussion.onnx',sess_options=options,providers=['CPUExecutionProvider'])
differences=[];cpu=[];missing=[]
for i in range(4,len(times),5):
 selected=x[max(0,i-99):i+1];offset=100-len(selected);tensor=np.zeros((1,100,84,1),np.float32);tensor[0,offset:,:,0]=selected
 scores=session.run(None,{'audio':tensor})[0].reshape(100,5)
 for j in range(85,90):
  index=i-99+j
  if index<0:continue
  t=float(times[index]);cpu.append({'audioTime':t,'scores':scores[j].tolist()});other=actual.get(round(t,8))
  if other is None:missing.append(t)
  else:differences.extend(abs(scores[j]-np.asarray(other)).tolist())
numeric={'matchedFrames':len(differences)//5,'missingObservedFrames':missing,
 'maxAbsoluteActivationDifference':max(differences),'p95AbsoluteActivationDifference':float(np.percentile(differences,95)),
 'scope':'CPU ONNX uses exact actual production feature windows, zero padding, stride5 and outputs85:90; compares WASM scores. New parity check, not a repeated model benchmark.'}
packet={'variants':['L0','L1-gap0'],'items':[{'id':'actual-captured-features','frames':cpu}]}
replay=json.loads(subprocess.run(['node','scripts/replay-early-percussion-decisions.mjs'],input=json.dumps(packet).encode(),capture_output=True,check=True).stdout)['runs'][0]
key=lambda e:(int(e['classIndex']),round(e.get('audioTime',e.get('time')),8))
cpu_events=replay['variants'][data['detector']]['events'];emitted=data['predictions']
cpu_keys={key(e) for e in cpu_events};actual_keys={key(e) for e in emitted}
numeric['decisionEventIdentitiesEqual']=cpu_keys==actual_keys
numeric['cpuEvents']=len(cpu_keys);numeric['actualEvents']=len(actual_keys)
numeric['cpuOnly']=list(cpu_keys-actual_keys);numeric['actualOnly']=list(actual_keys-cpu_keys)
raw=json.loads((run/'foreground-latency-live-a.json').read_text())
rows=raw['trace']['telemetry']['records']+raw['offscreen']['telemetry']['records']+raw['backgroundTelemetry']['records']
stages={};details=[]
for e in emitted:
 source_time=origin/sr+e['audioTime']-blocks[0]['startTime']
 if not 20<=source_time<50:continue
 trace=e['traceId'];records=[r for r in rows if trace and r.get('id')==trace]
 selected={s:any(r.get('stage')==s and (c is None or r.get('component')==c) for r in records)
  for s,c in [('EVENT_SENT','offscreen'),('EVENT_RECEIVED','media-bridge'),('EVENT_ACCEPTED','beat-controller'),('EVENT_COMMITTED','beat-renderer'),('EVENT_RENDERED','beat-renderer')]}
 for s,v in selected.items():stages[s]=stages.get(s,0)+int(v)
 details.append({'classIndex':e['classIndex'],'band':e['band'],'predictedSourceTime':source_time,
 'predictionAudioTime':e['audioTime'],'traceId':trace,'rejected':e['rejected'],'acousticReference':None,'stages':selected,
 'records':records,'detectorTiming':e.get('timing')})
result={'sourceId':data['sourceId'],'detector':data['detector'],'pcm':pcm,'sameFeatureNumericalParity':numeric,
 'passage':{'start':20,'end':50,'predicted':len(details),'stages':stages,'events':details},
 'sameInputDecisionReplays':replay,'physicalSynchronization':'UNVERIFIED','officialSongMetricsAllowed':False}
(run/'controlled-parity.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'pcm':pcm,'numerical':numeric,'passagePredicted':len(details),'stages':stages}))
