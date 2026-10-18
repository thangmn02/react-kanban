"""Bounded private Hat investigation. Frozen files are read, never rewritten."""
import argparse,asyncio,hashlib,importlib.util,json,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
import numpy as np
import soundfile as sf

ROOT=Path.cwd();OUT=ROOT/'scratch/hat-recovery';V2=ROOT/'scratch/beat-grid-v2';FULL=ROOT/'scratch/acoustic-visual-lab/full-songs'
N1='edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a'
P1='349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f'
S1='2693f11c0f6f605a25574e3a73032ef709ae6d64c0d8b7461fcff1a397c2e7bd'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
core=module('hat_core',ROOT/'scripts/hat-recovery-core.py');prep=module('full_prep',ROOT/'scripts/prepare-full-song.py');scoring=module('hat_scoring',ROOT/'scripts/score-beat-v2-round.py')
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=True,indent=2),encoding='utf-8')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def freeze():
 OUT.mkdir(parents=True,exist_ok=True);index=read(FULL/'songs.json');files={}
 paths=['scripts/run-beat-v2-inference.py','scripts/beat-v2-baseline-bridge.mjs','scripts/full-song-numerics.py','scripts/full-song-lab.tsx','scripts/full-song-audio.ts','scripts/acoustic-frame-sampling.ts','scripts/browser-hat-transient.css','src/features/music/BeatPattern.tsx','extensions/kanban-music/percussion-classifier.js','extensions/kanban-music/percussion-features.js','extensions/kanban-music/generated/percussion/percussion.json']
 for path in paths:files[path]=sha(ROOT/path)
 old=read(V2/'final-revision.json')
 for path,expected in old['artifactSha256'].items():
  target=V2/path;assert sha(target)==expected,('Changed old evidence',path);files[str(target.relative_to(ROOT))]=expected
 for identifier in [N1,P1,S1]:
  entry=index['sources'][identifier];assert sha(entry['source'])==identifier
  folder=FULL/identifier;status=read(folder/'status.json');assert status['state']=='READY'
  for name in ['canonical.wav','source.json','A.json','B.json','C.json']:
   p=folder/name;files[str(p.relative_to(ROOT))]=sha(p)
  for m in ['A','B','C']:
   record=read(folder/(m+'.json'));assert sha(folder/(m+'.json'))==status['models'][m]['resultSha256'];assert sha(folder/record['rawFile'])==record['rawSha256'];files[str((folder/record['rawFile']).relative_to(ROOT))]=record['rawSha256']
 evidence={'baseRevision':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'files':files,'createdAt':time.time(),'thresholds':list(core.THRESHOLDS),'thresholdProtocol':'Retrospective development-only diagnostic; all settings reported; no default selected. Previously frozen holdout is not a fresh confirmatory set.','cases':{'N1':{'source':N1,'start':26,'end':44,'status':'USER_REPORTED_HAT_NEGATIVE'},'P1':{'source':P1,'start':None,'end':None,'status':'PENDING_USER_SELECTION_OF_REVIEWED_DENSE_SUBSET','observation':'User reports B Hat is better across this recording; no independently labeled positive subset.'},'S1':{'source':S1,'start':200,'end':220,'status':'USER_REPORTED_REPEATED_PATTERN_LOSS','literalPatternReference':False}}}
 if (OUT/'freeze.json').exists():
  prior=read(OUT/'freeze.json');assert prior['files']==files,'Frozen evidence changed';return prior
 write(OUT/'freeze.json',evidence);return evidence

def fixture(inference,contract):
 folder=OUT/'sequence';folder.mkdir(exist_ok=True);path=folder/'S1.wav';manifest=folder/'reference.json'
 if not manifest.exists():
  sr=44100;audio=np.zeros((512*4700,2),np.float32);rng=np.random.default_rng(170818);signals={}
  for kind,length in [('kick',.2),('hat',.05),('snare',.12)]:
   t=np.arange(round(length*sr))/sr;noise=rng.uniform(-1,1,len(t))
   signal=(np.sin(2*np.pi*(55*t+70*.025*(1-np.exp(-t/.025))))*np.exp(-t/.055) if kind=='kick' else (np.diff(noise,prepend=0)*.3+.04*sum(np.sin(2*np.pi*f*t) for f in [4400,6200,8100]))*np.exp(-t/.012) if kind=='hat' else (noise*.6+np.sin(2*np.pi*180*t)*.25)*np.exp(-t/.035))
   signals[kind]=(signal*.4).astype(np.float32)
  refs=[];cycles=[];pattern=['kick','hat','kick','hat','kick','hat','hat','hat']
  for condition,base in [('identical-cnn-frame-aligned',100),('weak-hat-overlap',1400),('cnn-batch-boundary',3800)]:
   for cycle in range(6):
    first=base+cycle*100;start=first*512/sr;end=(first+100)*512/sr;cycles.append({'condition':condition,'cycle':cycle+1,'start':start,'end':end,'cnnFrame':first,'batchBoundaryInside':first<=4096<first+100})
    for slot,kind in enumerate(pattern):
     kinds=[kind]+(['snare'] if condition=='weak-hat-overlap' and kind=='hat' and slot in [3,6] else [])
     for instrument in kinds:
      sample=(first+slot*10)*512;level=.25 if condition=='weak-hat-overlap' and instrument=='hat' else 1
      signal=signals[instrument]*level;audio[sample:sample+len(signal)]+=signal[:,None]
      refs.append({'row':instrument,'time':sample/sr,'condition':condition,'cycle':cycle+1,'level':level,'sample':sample})
  sf.write(path,audio,sr,subtype='FLOAT');write(manifest,{'id':'S1-controlled','sha256':sha(path),'duration':len(audio)/sr,'referenceStatus':'deterministic-synthetic-reference','kind':'controlled-acoustic','scoreEligible':True,'partition':'development','domain':'drum-only','references':refs,'cycles':cycles,'seed':170818,'description':'18 explicitly labeled cycles; identical CNN-frame-aligned repetitions, weak Hats with Snare overlap, and unchanged centered features across frame4096 batching. Pattern is a controlled example, not claimed natural transcription.'})
 reference=read(manifest);assert sha(path)==reference['sha256'];records={};raw={};identity=prep.digest(contract)
 for m,lane in [('A','BASE'),('B','C1')]:
  target=folder/(m+'.json');cache=folder/(m+'.npz')
  if target.exists():
   record=read(target);assert record['contractSha256']==identity and record['inputSha256']==reference['sha256'] and record['npzSha256']==sha(cache)
  else:
   print('New controlled sequence inference '+m,flush=True);model=inference.load(lane);result=inference.infer(lane,model,{'id':'hat-recovery-S1','path':str(path),'sha256':reference['sha256']},target);del model
   events=[]
   for i,e in enumerate(sorted(result['events'],key=lambda e:e['time'])):events.append({**e,'sourceTime':e['time'],'id':f'S1:{m}:{i}','rawIndex':i,'recordSha256':reference['sha256']})
   record={'inputSha256':reference['sha256'],'contractSha256':identity,'events':events,'metadata':{k:v for k,v in result.items() if k not in ['events','rawEvents','publishedResult']},'npzSha256':sha(cache)};write(target,record)
  records[m]=record
  saved=np.load(cache);raw[m]={'times':saved['times'],'scores':saved['scores']} if m=='A' else {'times':np.arange(len(saved['logits']))*core.CNN_STEP,'scores':core.sigmoid(saved['logits'])}
 return path,reference,records,raw

def spectral(y,sr,t):
 center=round(t*sr);part=y[max(0,center-round(.04*sr)):center+round(.08*sr)].mean(axis=1);n=1<<(len(part)-1).bit_length()
 spectrum=abs(np.fft.rfft(part*np.hanning(len(part)),n=n))**2;freq=np.fft.rfftfreq(n,1/sr);total=float(spectrum.sum())+1e-20
 pre=y[max(0,center-round(.04*sr)):center].mean(axis=1);post=y[center:center+round(.04*sr)].mean(axis=1)
 before=abs(np.fft.rfft(pre*np.hanning(len(pre)),n=2048));after=abs(np.fft.rfft(post*np.hanning(len(post)),n=2048));normalized_flux=float(np.maximum(after/(after.sum()+1e-20)-before/(before.sum()+1e-20),0).sum())
 return {'rmsBefore':float(np.sqrt(np.mean(pre**2))),'rmsAfter':float(np.sqrt(np.mean(post**2))),'centroidHz':float((freq*spectrum).sum()/total),'energyFractionAbove4kHz':float(spectrum[freq>=4000].sum()/total),'energyFractionBelow250Hz':float(spectrum[freq<250].sum()/total),'spectralFlatness':float(np.exp(np.mean(np.log(spectrum+1e-20)))/(np.mean(spectrum)+1e-20)),'normalizedPositiveSpectralFlux':normalized_flux,'spectralScope':'Full -40/+80ms Hann spectrum; flux compares normalized -40/0 and 0/+40ms magnitude spectra. No semantic identity follows from these features.','instrumentAttribution':'UNKNOWN: spectral characteristics alone cannot distinguish sibilance, cymbal, shaker, synth or true Hat.'}

def load_source(identifier):
 folder=FULL/identifier;source=read(folder/'source.json');assert sha(folder/'canonical.wav')==source['canonicalWavSha256'];records={m:read(folder/(m+'.json')) for m in ['A','B','C']};raw={m:read(folder/r['rawFile']) for m,r in records.items()};return folder,source,records,raw

def frontend_parity(inference,folder,raw):
 # Replay captured logits through the unmodified official endpoint. No neural rerun.
 from starlette.datastructures import UploadFile
 from tempfile import TemporaryDirectory
 model=inference.load('C1');official=V2/'sources/C1/webUI/server.py';record=read(folder/'B.json');npz=folder/record['rawFile'].replace('raw.json','inference.npz');logits=np.load(npz)['logits']
 frozen_scores=np.asarray(raw['B']['scores'],dtype=np.float32);probabilities=core.sigmoid(logits)
 assert probabilities.shape==frozen_scores.shape and np.array_equal(probabilities,frozen_scores),'Saved logits do not reproduce the entire frozen raw-score matrix'
 provenance={'path':str(npz.relative_to(ROOT)),'npzSha256':sha(npz),'frozenRawSha256':record['rawSha256'],'shape':list(logits.shape),'sigmoidMatrixExactlyEqual':True,'maximumAbsoluteProbabilityDifference':float(np.max(abs(probabilities-frozen_scores)))}
 provenance_path=OUT/'logit-provenance.json'
 if provenance_path.exists():assert read(provenance_path)==provenance,'Bound logits changed'
 else:write(provenance_path,provenance)
 class Replay:
  def __init__(self):self.offset=0;self.logits=[];self.cost=0;self.batches=[]
  def run(self,unused,inputs):
   windows=inputs['input'];count=len(windows);self.batches.append({'startFrame':self.offset,'frames':count,'firstContextSha256':hashlib.sha256(windows[0].tobytes()).hexdigest(),'lastContextSha256':hashlib.sha256(windows[-1].tobytes()).hexdigest()});result=logits[self.offset:self.offset+count];assert len(result)==count;self.offset+=count;self.logits.append(result);return [result]
 replay=Replay();model.SESSION=replay
 with TemporaryDirectory() as temp:
  out=Path(temp)/'parity.json';result=inference.infer('C1',model,{'path':str(folder/'canonical.wav'),'id':'official-parity'},out)
  observed=sorted((e['instrument'],e['time']) for e in result['events']);expected=sorted((e['instrument'],e['sourceTime']) for e in record['events']);assert observed==expected
 assert replay.offset==len(logits)
 wave,_=model.librosa.load(str(folder/'canonical.wav'),sr=model.SR,mono=True);mel=model.librosa.feature.melspectrogram(y=wave,sr=model.SR,n_fft=model.N_FFT,hop_length=model.HOP,n_mels=model.N_MELS);indices=(np.arange(mel.shape[1])*core.CNN_STEP>=26)&(np.arange(mel.shape[1])*core.CNN_STEP<44);local=mel[:,indices]
 full_db=model.librosa.power_to_db(mel,ref=np.max)[:,indices];local_db=model.librosa.power_to_db(local,ref=np.max)
 context={'variantId':'frontend-local-reference-feature-diagnostic-v1','neuralInferenceRun':False,'fullMelMaximum':float(mel.max()),'N1MelMaximum':float(local.max()),'localVsFullReferenceDifferenceDb':float(10*np.log10(mel.max()/local.max())),'maximumFeatureDifferenceDb':float(np.max(abs(local_db-full_db))),'meaning':'Same STFT frames; only hypothetical local dB reference changed. This is not the released whole-clip contract and is not used for prediction or accepted as a fix.'}
 return {'status':'PASS','officialSourceSha256':sha(official),'fullSongAdapterSha256':sha(ROOT/'scripts/run-beat-v2-inference.py'),'logitProvenance':provenance,'contextDiagnostic':context,'method':'Exact frozen adapter invokes the unchanged official transcribe endpoint. Saved logits replayed through official postprocessing after complete matrix parity against frozen raw scores; no repeated neural inference. Full-waveform official features execute before the 4096-window batches.','frames':len(logits),'batches':replay.batches,'eventParity':True,'sampleRate':22050,'hop':256,'melBins':96,'fft':1024,'centeredContextFrames':3,'deltaWidthFrames':9,'globalDbReference':'np.max on whole recording','boundaryPadding':'Centered STFT reflect; zero padding of 3 context frames at recording edges only','independentAnalysisChunks':False,'streamingQualified':False}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--freeze-only',action='store_true');args=parser.parse_args();frozen=freeze()
 if args.freeze_only:print(json.dumps({'status':'FROZEN','files':len(frozen['files'])}));return
 inference,contract=prep.contracts();assert prep.digest(contract)==read(FULL/N1/'source.json')['analysisRevision']
 sources={};source_data={}
 for identifier in [N1,P1,S1]:
  folder,source,records,raw=load_source(identifier);source_data[identifier]=(folder,source,records,raw)
  for m in ['A','B']:
   if m=='B':assert core.cnn_edges(np.asarray(raw[m]['scores']))==[e['sourceTime'] for e in records[m]['events'] if e['instrument']=='hat']
  sources[identifier]={'id':identifier,'filename':source['originalFilename'],'source':source,'models':{m:{'events':r['events'],'recordSha256':sha(folder/(m+'.json')),'rawSha256':r['rawSha256']} for m,r in records.items()},'audioPath':str(folder/'canonical.wav'),'waveformPath':str(folder/'waveform.json')}
 folder,source,records,raw=source_data[N1];y,sr=sf.read(folder/'canonical.wav',dtype='float32',always_2d=True)
 replay=json.loads(subprocess.run(['node','scripts/trace-hat-decisions.mjs'],input=json.dumps({**raw['A'],'start':26,'end':44}),text=True,capture_output=True,check=True).stdout)
 actual=[(e['audioTime'],e['classIndex']) for e in replay['events']];assert actual==[(e['sourceTime'],int(e['rawClass'])) for e in records['A']['events']]
 decisions={(d['classIndex'],round(d['audioTime'],6)):d for d in replay['decisions']};ledger=[]
 for m in ['A','B']:
  times=np.asarray(raw[m]['times']);scores=np.asarray(raw[m]['scores'])
  for e in records[m]['events']:
   if not 26<=e['sourceTime']<44 or e['instrument'] not in ['hat','cymbal']:continue
   t=e['sourceTime'];col=2 if m=='B' else int(e['rawClass']);index=int(np.argmin(abs(times-t)));decision=decisions.get((col,round(float(times[index]),6))) if m=='A' else None
   item={'predictionId':e['id'],'model':m,'modelSha256':records[m]['contract']['identities'][m]['contract']['modelSha256'],'sourceTime':t,'instrument':e['instrument'],'rawClass':e['rawClass'],'rawIndex':index,'rawScore':float(scores[index,col]),'neighborFrames':[{'time':float(times[j]),'scores':scores[j].tolist()} for j in range(max(0,index-4),min(len(scores),index+5))],'postprocessing':decision or {'action':'accepted-rising-edge','threshold':.5,'comparison':'>','run':core.accepted_run(scores,index)},'thresholdDecisionValue':decision['novelty'] if decision else float(scores[index,col]),'thresholdMargin':decision['novelty']-decision['threshold'] if decision else float(scores[index,col]-.5),'nearestBatchBoundarySeconds':min(t,times[-1]-t,min(abs(t-b*4096*core.CNN_STEP) for b in range(1,int(len(times)/4096)+1))) if m=='B' else min(t,times[-1]-t),'boundaryMeaning':'B batches independent centered windows, not independent normalized chunks; A original 10ms activation stream/50ms inference steps','distanceFromOriginal50msStepSeconds':float(min((t% .05),.05-t%.05)) if m=='A' else None,'acoustics':spectral(y,sr,t),'acousticStatus':'USER_REPORTED_ABSENT_NOT_INDEPENDENTLY_VERIFIED','suspectedCategory':'UNKNOWN_HIGH_FREQUENCY_SOURCE','humanConfirmedFalse':False,'rendererStatus':'PENDING_MEASURED_REPLAY'}
   ledger.append(item)
 counts={m:core.count_interval(records[m]['events'],26,44) for m in ['A','B']}
 negative={'case':frozen['cases']['N1'],'source':source,'counts':counts,'publicSharedRowCounts':{m:sum(counts[m][c] for c in ['hat','cymbal','grouped-percussion']) for m in counts},'cnnAboveThresholdFrameCount':int(np.sum((np.asarray(raw['B']['times'])>=26)&(np.asarray(raw['B']['times'])<44)&(np.asarray(raw['B']['scores'])[:,2]>.5))),'events':ledger,'decision':'AMBIGUOUS / NOT VERIFIED','officialMetrics':False,'reason':'User reports no Hat; sound-source categories and individual absence are not independently verified. Exact event counts are predictions, not verified false-positive counts.'}
 correlations={}
 for m in ['A','B']:
  selected=[e for e in ledger if e['model']==m and e['instrument']=='hat'];scores=np.asarray([e['rawScore'] for e in selected]);correlations[m]={'events':len(selected),'scope':'Exploratory association within model-selected proposals; not correctness, source identity or a causal finding','pearsonScoreVsAcousticFeature':{k:float(np.corrcoef(scores,[e['acoustics'][k] for e in selected])[0,1]) for k in ['energyFractionAbove4kHz','normalizedPositiveSpectralFlux','rmsAfter']}}
 negative['featureAssociations']=correlations
 write(OUT/'negative-ledger.json',negative);write(OUT/'frontend-parity.json',frontend_parity(inference,folder,raw))
 path,reference,sequence_records,sequence_raw=fixture(inference,contract);identifier=reference['sha256'];pcm=hashlib.sha256(sf.read(path,dtype='float32',always_2d=True)[0].astype('<f4').tobytes()).hexdigest()
 sources[identifier]={'id':identifier,'filename':'S1 — controlled repeated Kick/Hat sequence','source':{'originalSha256':identifier,'canonicalWavSha256':identifier,'decodedPcmSha256':pcm,'analysisRevision':prep.digest(contract),'duration':reference['duration'],'sampleRate':44100,'channels':2,'transforms':{'timeOrigin':'generated sample0','padding':0}},'models':{m:{'events':r['events'],'recordSha256':sha(path.parent/(m+'.json')),'rawSha256':r['npzSha256']} for m,r in sequence_records.items()},'audioPath':str(path),'waveformPath':None,'reference':reference}
 sequence=[]
 for cycle in reference['cycles']:
  result={**cycle,'models':{}}
  for m in ['A','B']:
   events=sequence_records[m]['events'];times=np.asarray(sequence_raw[m]['times']);scores=np.asarray(sequence_raw[m]['scores']);per_class={}
   for cls,col in [('kick',0),('hat',3 if m=='A' else 2)]:
    refs=[r['time'] for r in reference['references'] if r['condition']==cycle['condition'] and r['cycle']==cycle['cycle'] and r['row']==cls];all_refs=[r['time'] for r in reference['references'] if r['row']==cls];preds=[e['sourceTime'] for e in events if e['instrument']==cls];metrics=core.cycle_metrics(all_refs,preds,cycle['start'],cycle['end'],scoring.match)
    per_class[cls]={**metrics,'references':[{'time':t,'peakScoreWithin40ms':float(scores[abs(times-t)<=.04,col].max()) if np.any(abs(times-t)<=.04) else None,'nearestRawFrame':float(times[np.argmin(abs(times-t))])} for t in refs],'acceptedTimes':metrics['acceptedMatchedTimes']+metrics['unmatchedPredictionTimes']}
   result['models'][m]=per_class
  sequence.append(result)
 sequence_decisions=json.loads(subprocess.run(['node','scripts/trace-hat-decisions.mjs'],input=json.dumps({'times':sequence_raw['A']['times'].tolist(),'scores':sequence_raw['A']['scores'].tolist(),'start':0,'end':reference['duration']}),text=True,capture_output=True,check=True).stdout)
 for cycle in sequence:
  for cls,col in [('kick',0),('hat',3)]:
   outcome=cycle['models']['A'][cls]
   for ref in outcome['references']:
    nearby=[d for d in sequence_decisions['decisions'] if d['classIndex']==col and abs(d['audioTime']-ref['time'])<=.04]
    novelty=max((d['novelty'] for d in nearby),default=None);ref['peakNoveltyWithin40ms']=novelty;ref['configuredNoveltyThreshold']=sequence_decisions['thresholds'][col]
    matched=any(abs(t-ref['time'])<=.04 for t in outcome['acceptedMatchedTimes'])
    ref['firstObservableLossStage']='MATCHED' if matched else 'POSTPROCESSING_NOVELTY_THRESHOLD' if novelty is not None and novelty<ref['configuredNoveltyThreshold'] else 'POSTPROCESSING_LOCAL_PEAK_GROUPING_OR_TIMING_REQUIRES_REVIEW'
 logits=np.load(path.parent/'B.npz')['logits'];batch_parity=[]
 for condition in sorted({c['condition'] for c in reference['cycles']}):
  cycles=[c for c in reference['cycles'] if c['condition']==condition];base=cycles[1]['cnnFrame'];template=logits[base:base+80]
  batch_parity.append({'condition':condition,'referenceCycle':2,'comparedFramesPerCycle':80,'maximumLogitDifferenceByCycle':[float(np.max(abs(logits[c['cnnFrame']:c['cnnFrame']+80]-template))) for c in cycles],'interpretation':'Measured identical CNN-frame-aligned audio. Batch4096 does not reset frontend context. A uses a different 10ms feature lattice; this fixture is not phase-aligned to both lattices.'})
 natural_folder,natural_source,natural_records,natural_raw=source_data[S1];natural=[]
 for start in range(200,220,4):
  entry={'start':start,'end':start+4,'scope':'Fixed time bin, NOT an independently labeled musical cycle','models':{}}
  for m in ['A','B']:
   times=np.asarray(natural_raw[m]['times']);scores=np.asarray(natural_raw[m]['scores']);indices=(times>=start)&(times<start+4);values=scores[indices,3 if m=='A' else 2];entry['models'][m]={'predictedCounts':core.count_interval(natural_records[m]['events'],start,start+4),'rawFrames':int(indices.sum()),'status':'AVAILABLE' if len(values) else 'UNAVAILABLE_RAW_COVERAGE','hatScoreMaximum':float(values.max()) if len(values) else None,'hatScoreMean':float(values.mean()) if len(values) else None,'thresholdMeaning':'A novelty, not raw score' if m=='A' else 'B raw score rising edge >.5'}
  natural.append(entry)
 write(OUT/'sequence-results.json',{'reference':reference,'cycles':sequence,'cnnLogitCycleParity':batch_parity,'naturalCase':frozen['cases']['S1'],'naturalTimeBins':natural,'naturalCycleReferences':'PENDING independent cycle/onset review; user pattern was illustrative, not a transcription.'})
 # Re-score saved C1 raw outputs only. Original 65-input inference and prior metrics stay untouched.
 manifest=read(V2/'corpus-manifest.json');sweep=[]
 for threshold in core.THRESHOLDS:
  scored=[];diagnostics=[]
  for item in manifest['items']:
   target=V2/'results/C1'/(item['id']+'.json');r=read(target);cache=target.with_suffix('.npz');scoring.evidence.validate(r,item,scoring.evidence.identity('C1'),cache)
   probs=core.sigmoid(np.load(cache)['logits']);preds=core.cnn_edges(probs,threshold);start=item.get('analysisStart',0);end=item.get('analysisEnd',item['duration']);preds=[t for t in preds if start<=t<end]
   if threshold==.5:assert preds==sorted(e['time'] for e in r['events'] if e['instrument']=='hat' and start<=e['time']<end),('Historical baseline extraction differs',item['id'])
   if item['scoreEligible']:
    assert item['referenceStatus'] in ['deterministic-synthetic-reference','published-independent-dataset-reference'];refs=[e['time'] for e in item['references'] if e['row']=='hat' and start<=e['time']<end];metrics=core.reference_metrics(refs,preds,scoring.match,end-start,.05 if item['kind']=='independent-natural-reference' else .04);scored.append({'id':item['id'],'kind':item['kind'],'partition':item['partition'],'domain':item['domain'],**metrics})
   else:diagnostics.append({'id':item['id'],'predictedHatCount':len(preds),'referenceStatus':item['referenceStatus'],'officialMetrics':False})
  grouped={}
  for key in sorted({(s['kind'],s['partition'],s['domain']) for s in scored}):grouped[' / '.join(key)]=core.aggregate_metrics([s for s in scored if (s['kind'],s['partition'],s['domain'])==key])
  natural_counts={}
  for source_id,(_,src,rs,rr) in source_data.items():
   events=core.threshold_track(np.asarray(rr['B']['scores']),threshold,source_id);natural_counts[source_id]={'wholeSongHatCount':len(events),'N1HatCount':core.count_interval(events,26,44)['hat'] if source_id==N1 else None,'officialMetrics':False}
  control_metrics=[]
  for cycle in reference['cycles']:
   refs=[r['time'] for r in reference['references'] if r['row']=='hat'];preds=core.cnn_edges(sequence_raw['B']['scores'],threshold);control_metrics.append({**cycle,**core.cycle_metrics(refs,preds,cycle['start'],cycle['end'],scoring.match)})
  sweep.append({'id':core.variant_id(threshold),'threshold':threshold,'groups':grouped,'perInput':scored,'provisionalDiagnostics':diagnostics,'naturalCounts':natural_counts,'sequenceCycles':control_metrics})
 write(OUT/'threshold-sweep.json',{'protocol':frozen['thresholdProtocol'],'settings':sweep,'selectedDefault':None,'positiveNaturalRecall':'UNAVAILABLE: Nujabes has no complete independent onset reference','mitigation':'No feature rejection or agreement filter selected without a demonstrated sound-source mechanism.'})
 # Source-bound private view snapshots; original event records are never modified.
 public_sources={}
 for source_id,s in sources.items():
  model_tracks={m:v['events'] for m,v in s['models'].items()};tracks={m:{'label':{'A':'Frozen ADTOF','B':'Frozen Frame CNN','C':'OAF + HTDemucs (diagnostic)'}[m],'events':events,'baseline':True} for m,events in model_tracks.items()}
  if 'B' in model_tracks:
   probs=sequence_raw['B']['scores'] if source_id==identifier else np.asarray(source_data[source_id][3]['B']['scores'])
   for threshold in core.THRESHOLDS:
    if threshold==.5:continue
    tracks[core.variant_id(threshold)]={'label':f'Experimental CNN Hat >{threshold} (diagnostic only)','events':core.threshold_track(probs,threshold,source_id),'baseline':False,'threshold':threshold}
  tracks['H0-frozen-routing-diagnostic-v1']={'label':'H0 hypothetical: frozen A Kick/Snare + frozen B Hat · UNQUALIFIED','events':core.hypothetical_hybrid(model_tracks['A'],model_tracks['B']),'baseline':False}
  for t in tracks.values():
   if not t['baseline']:
    for e in t['events']:
     if e.get('baseModel')=='B':e['recordSha256']=s['models']['B']['recordSha256'];e['baseRawSha256']=s['models']['B']['rawSha256']
  coverage={}
  raw_tracks=sequence_raw if source_id==identifier else source_data[source_id][3]
  for m,r in raw_tracks.items():
   step=core.CNN_STEP if m=='B' else .01;times=list(r['times']);intervals=[];covered=0
   for t in times:
    if t>covered+1e-6:intervals.append({'start':covered,'end':min(t,s['source']['duration']),'reason':'No saved original raw frames'})
    covered=max(covered,min(s['source']['duration'],t+step))
   if covered<s['source']['duration']-1e-6:intervals.append({'start':covered,'end':s['source']['duration'],'reason':'Original EOF context unavailable; no padding'})
   coverage[m]={'completeRawCoverage':not intervals,'uncoveredIntervals':intervals}
  raw_export={m:{'times':np.asarray(r['times']).tolist(),'scores':np.asarray(r['scores']).tolist(),'classes':['kick','snare','tom','hat','cymbal'] if m=='A' else ['kick','snare','hat']} for m,r in raw_tracks.items() if m in ['A','B']};write(OUT/('raw-'+source_id+'.json'),raw_export)
  clip={'id':source_id,'source':s['source'],'tracks':tracks,'coverage':coverage,'reference':s.get('reference')};write(OUT/(source_id+'.json'),clip)
  public_sources[source_id]={k:v for k,v in s.items() if k!='models'}
 cases=[{'id':'N1','label':'N1 · Rằng [26,44) · user-reported Hat-negative','source':N1,'start':26,'end':44,'referenceStatus':'USER_REPORTED_HAT_NEGATIVE'},{'id':'P1','label':'P1 · Nujabes · whole-song listening; reviewed rapid subset pending','source':P1,'start':0,'end':sources[P1]['source']['duration'],'referenceStatus':'PROVISIONAL_WHOLE_SONG_OBSERVATION_NO_COMPLETE_ONSETS'},{'id':'S1','label':'S1 · Chinese song [200,220) · user-reported repeat loss','source':S1,'start':200,'end':220,'referenceStatus':'USER_REPORTED_REPEATED_PATTERN_LOSS'},{'id':'S1-control','label':'S1 control · 18 labeled Kick/Hat cycles','source':identifier,'start':reference['cycles'][0]['start']-.2,'end':reference['cycles'][-1]['end']+.2,'referenceStatus':'DETERMINISTIC_SYNTHETIC_REFERENCE'}]
 for case in cases:assert 0<=case['start']<case['end']<=sources[case['source']]['source']['duration'],('Requested case outside its exact source',case)
 write(OUT/'view-data.json',{'version':1,'cases':cases,'sources':public_sources,'negative':negative,'sequence':sequence,'sweepSummary':[{k:v for k,v in s.items() if k in ['id','threshold','groups','naturalCounts']} for s in sweep],'frontendParity':read(OUT/'frontend-parity.json'),'decisions':{'negative':'AMBIGUOUS / NOT VERIFIED','repeatedNatural':'INCONCLUSIVE until independently reviewed cycle/onset labels','cnnRecovery':'INCONCLUSIVE','hybrid':'NOT YET JUSTIFIED','furtherPrivateTesting':'NO-GO for an accepted corrected hybrid; H0 routing is diagnostic only'},'limits':{'officialNaturalMetricsOnly':'Published independent MDB references; provisional songs never scored','physicalSynchronizationVerified':False,'humanListeningVerified':False}})
 write(OUT/'view-manifest.json',{'version':1,'files':{p.name:sha(p) for p in [OUT/'view-data.json',*[OUT/(identifier+'.json') for identifier in sources],*[OUT/('raw-'+identifier+'.json') for identifier in sources]]},'producerSourceSha256':sha(__file__),'coreSourceSha256':sha(ROOT/'scripts/hat-recovery-core.py')})
 # All original research and full-song result hashes must still match the opening freeze.
 for path,expected in frozen['files'].items():assert sha(ROOT/path)==expected,('Frozen evidence modified',path)
 print(json.dumps({'status':'ANALYSIS_COMPLETE','N1':counts,'sequenceCycles':len(sequence),'thresholdSettings':len(sweep),'sources':len(sources)}),flush=True)

if __name__=='__main__':main()
