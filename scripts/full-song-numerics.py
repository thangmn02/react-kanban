"""Numerical full-recording transforms; source hash is part of every cache key."""
import hashlib,json,os,random,time
from pathlib import Path
import numpy as np
import soundfile as sf
ROOT=Path('scratch/beat-grid-v2').resolve()
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def valid_separator(stem,receipt,contract,seed,frames):
    try:
        value=read(receipt)
        return value if isinstance(value,dict) and value.get('contract')==contract and value.get('seed')==seed and value.get('frames')==frames and value.get('sha256')==sha(stem) else None
    except (OSError,ValueError,TypeError):return None

def canonical_audio(source,folder,filename,source_sha,contract,contract_sha,write):
    info=sf.info(source)
    if not 1<=info.duration<=720 or info.channels not in [1,2]:raise ValueError('Recording is BLOCKED: requires 1–720 seconds and mono/stereo audio')
    y,original_sr=sf.read(source,dtype='float32',always_2d=True)
    if not 1<=len(y)/original_sr<=720:raise ValueError('Recording must be 1–720 seconds; larger recordings are BLOCKED by this private lab memory limit')
    original_channels=y.shape[1]
    if original_channels not in [1,2]:raise ValueError('Only mono/stereo audio is supported; no silent multichannel downmix')
    if not np.isfinite(y).all():raise ValueError('Non-finite decoded samples')
    original_pcm=hashlib.sha256(y.astype('<f4').tobytes()).hexdigest()
    if original_sr!=44100:
        import librosa
        y=librosa.resample(y.T,orig_sr=original_sr,target_sr=44100,res_type='soxr_hq').T
    if original_channels==1:y=np.repeat(y,2,axis=1)
    y=np.ascontiguousarray(y,dtype=np.float32);canonical=folder/'canonical.wav'
    reuse_audio=False
    if canonical.exists() and (folder/'source.json').exists():
        prior_audio=read(folder/'source.json');reuse_audio=prior_audio['decodedPcmSha256']==hashlib.sha256(y.astype('<f4').tobytes()).hexdigest() and prior_audio['canonicalWavSha256']==sha(canonical)
    if not reuse_audio:
        temporary=folder/'canonical-pending.wav';sf.write(temporary,y,44100,subtype='FLOAT');os.replace(temporary,canonical)
    # Read back the actual container bytes used by all three models and playback.
    y,sr=sf.read(canonical,dtype='float32',always_2d=True);duration=len(y)/sr
    pcm_sha=hashlib.sha256(y.astype('<f4').tobytes()).hexdigest();wav_sha=sha(canonical)
    audio_identity={'originalFilename':filename,'originalSha256':source_sha,'originalDecodedPcmSha256':original_pcm,'originalSampleRate':original_sr,'originalChannels':original_channels,'canonicalWavSha256':wav_sha,'decodedPcmSha256':pcm_sha,'sampleRate':sr,'channels':2,'frames':len(y),'duration':duration,'decoder':contract['decoder'],'numericalImplementationSha256':sha(__file__),'transforms':{'resampled':original_sr!=sr,'monoDuplicated':original_channels==1,'trimmedSamples':0,'addedPaddingSamples':0,'timeOrigin':'first sample returned by libsndfile decoder = source time 0; codec delay/padding handled by that decoder, no additional guessed correction','codecDelayCorrectionAppliedByLab':0},'analysisRevision':contract_sha}
    overview=[];detail=[]
    mono=y.mean(1)
    for step,dest in [(max(1,int(np.ceil(len(y)/2048))),overview),(441,detail)]:
        for start in range(0,len(y),step):
            part=mono[start:start+step];dest.append([float(part.min()),float(part.max())])
    write(folder/'source.json',audio_identity);write(folder/'waveform.json',{'overview':overview,'detail':detail,'detailStepSeconds':.01,'duration':duration})
    return y,sr,duration,pcm_sha,wav_sha,canonical,audio_identity

def drum_stem(y,sr,folder,key,pcm_sha,contract,progress,write):
    import torch
    from demucs.hf import load_safetensors_model
    from demucs.apply import apply_model
    torch.set_num_threads(4);seed=int(pcm_sha[:8],16);random.seed(seed);torch.manual_seed(seed)
    stem=folder/('drums-'+key+'.wav');stem_receipt=folder/('drums-'+key+'.json')
    cached=valid_separator(stem,stem_receipt,contract['identities']['separator'],seed,len(y))
    if cached:
        separator={**cached,'reused':True}
    else:
        stage=time.perf_counter();sep_model=load_safetensors_model(ROOT/'weights/first-separator/955717e8.safetensors').eval()
        wave=torch.from_numpy(y.T.copy());ref=wave.mean(0);std=ref.std();mean=ref.mean();normalized=(wave-mean)/std if float(std)>1e-8 else wave-mean
        progress(.15,'C · complete HTDemucs separation (official split/overlap; CPU4)')
        def sep_progress(info):
            progress(min(.65,.15+.5*(info.get('segment_offset',0)/max(1,len(y)))),'C · HTDemucs separation')
        with torch.no_grad():stems=apply_model(sep_model,normalized[None],shifts=1,split=True,overlap=.25,progress=False,device='cpu',callback=sep_progress)[0]
        stems=stems*std+mean if float(std)>1e-8 else stems+mean
        drums=stems[sep_model.sources.index('drums')].T.numpy();assert len(drums)==len(y),'Separator changed sample length'
        sf.write(stem,drums,sr,subtype='FLOAT');separator={'sha256':sha(stem),'seconds':time.perf_counter()-stage,'seed':seed,'frames':len(drums),'contract':contract['identities']['separator'],'reused':False};write(stem_receipt,separator)
        del sep_model,stems,wave,normalized,drums
    progress(.7,'C · whole-recording corrected OAF inference');return stem,separator

def prediction_tracks(label,result,out,duration,source_sha,key):
    events=[]
    for index,event in enumerate(sorted(result['events'],key=lambda e:e['time'])):
        if not 0<=event['time']<duration:continue
        instrument='grouped-percussion' if label=='C' and event['instrument']=='hat' else event['instrument']
        events.append({**event,'id':f'full:{source_sha}:{label}:{index}','sourceTime':event['time'],'instrument':instrument,'rawIndex':index,'recordSha256':key})
    saved=np.load(out.with_suffix('.npz'))
    if label=='A':times=saved['times'];scores=saved['scores'];classes=['kick','snare','tom','hat','cymbal']
    elif label=='B':scores=1/(1+np.exp(-np.clip(saved['logits'],-80,80)));times=np.arange(len(scores))*256/22050;classes=['kick','snare','hat']
    else:scores=saved['onset'];times=np.arange(len(scores))*.01;classes=['kick','snare','tom','grouped-percussion','cymbal','cymbal','cymbal','other']
    raw={'times':times.tolist(),'scores':scores.tolist(),'classes':classes,'scope':'Saved whole-recording output before extraction. Uncalibrated; C Hat target is grouped. No external detector chunk boundaries.'}
    return events,raw
