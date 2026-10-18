"""One named online-normalization diagnostic on frozen B; not browser qualification."""
import hashlib,json,os,time
from pathlib import Path
os.environ.setdefault('OMP_NUM_THREADS','4');os.environ.setdefault('OPENBLAS_NUM_THREADS','4')
import numpy as np
import librosa,onnxruntime as ort,psutil
ROOT=Path('scratch/acoustic-visual-lab/full-songs');OUT=Path('scratch/hybrid-beta');OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def edges(scores):return np.flatnonzero((scores[1:,2]>.5)&~(scores[:-1,2]>.5))+1
def run():
    model=Path('scratch/beat-grid-v2/sources/C1/webUI/drum_cnn.onnx');model_sha=hashlib.sha256(model.read_bytes()).hexdigest();assert model_sha=='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'
    options=ort.SessionOptions();options.intra_op_num_threads=4;session=ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider']);runs=[]
    for source in ['edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a','349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f']:
        folder=ROOT/source;record=read(folder/'B.json');raw=read(folder/record['rawFile']);baseline=np.asarray(raw['scores']);started=time.perf_counter()
        y,_=librosa.load(folder/'canonical.wav',sr=22050,mono=True);mel=librosa.feature.melspectrogram(y=y,sr=22050,n_fft=1024,hop_length=256,n_mels=96)
        # A committed frame uses only the maximum observed so far, not the final song maximum.
        power_db=10*np.log10(np.maximum(1e-10,mel));running_max=np.maximum.accumulate(power_db.max(axis=0));online=np.maximum(power_db-running_max[None,:],-80)
        features=np.stack([online,librosa.feature.delta(online),librosa.feature.delta(online,order=2)]).astype(np.float32)
        padded=np.pad(features,((0,0),(0,0),(3,3)));windows=np.lib.stride_tricks.sliding_window_view(padded,7,axis=2).transpose(2,0,3,1)
        probs=[];batches=[]
        for i in range(0,len(windows),32):
            t=time.perf_counter();logits=session.run(None,{'input':np.ascontiguousarray(windows[i:i+32])})[0];batches.append((time.perf_counter()-t)*1000);probs.append(1/(1+np.exp(-np.clip(logits,-80,80))))
        scores=np.concatenate(probs);assert scores.shape==baseline.shape
        old,new=edges(baseline),edges(scores);old_set,new_set=set(old.tolist()),set(new.tolist());change=abs(scores-baseline)
        runs.append({'sourceSha256':source,'frames':len(scores),'duration':len(y)/22050,'savedBaselineRawSha256':record['rawSha256'],'savedBaselineReused':True,'baselineHatEdges':len(old),'onlineHatEdges':len(new),'identicalHatEdgeFrames':len(old_set&new_set),'removedOriginalEdgeFrames':len(old_set-new_set),'addedOnlineEdgeFrames':len(new_set-old_set),'hatActiveFrameDisagreementFraction':float(np.mean((scores[:,2]>.5)!=(baseline[:,2]>.5))),'scoreAbsoluteDifferenceMean':float(change.mean()),'scoreAbsoluteDifferenceMax':float(change.max()),'batch32InferenceMs':{'median':float(np.median(batches)),'p95':float(np.percentile(batches,95)),'worst':max(batches)},'totalOfflineSimulationSeconds':time.perf_counter()-started,'processResidentBytes':psutil.Process().memory_info().rss,'firstCommitBoundary':'Start/end centered feature behavior needs explicit live boundary handling; no live equivalence asserted.'})
    result={'variant':'C1-running-reference-centered-diagnostic-v1','checkpointSha256':model_sha,'threshold':.5,'thresholdSweep':False,'newModelSearch':False,'featureParameters':{'sampleRate':22050,'hop':256,'fft':1024,'melBins':96,'deltaWidth':9,'deltaFutureFrames':4,'cnnContextFutureFrames':3,'normalization':'per-frame observed running maximum; changed from full-recording global reference'},'minimumSteadyStateFutureAudioMs':(512+7*256)/22050*1000,'minimumFutureAudioFormula':'half centered FFT + four delta future hops + three CNN context future hops; excludes inference, worker cadence, IPC, scheduling and display','browserLiveImplemented':False,'browserLiveQualification':'BLOCKED / unqualified; Python diagnostic is not a browser live demonstration','physicalSynchronization':'UNVERIFIED','runs':runs};(OUT/'cnn-online-feasibility.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
if __name__=='__main__':run()
