"""Private full-recording preparation, reusing the frozen model implementations."""
import argparse,hashlib,importlib.util,json,os,random,sys,threading,time
from pathlib import Path
import numpy as np
import soundfile as sf
import psutil

os.environ.setdefault('OMP_NUM_THREADS','4')
os.environ.setdefault('OPENBLAS_NUM_THREADS','4')
sys.dont_write_bytecode=True
ROOT=Path('scratch/beat-grid-v2').resolve()
WRITE_LOCK=threading.RLock()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def write(p,v):
    # Windows readers/scanners may briefly deny replacement; preserve the previous
    # complete status document until the new one can be atomically installed.
    with WRITE_LOCK:
        p=Path(p);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(v),encoding='utf-8')
        for attempt in range(50):
            try:os.replace(tmp,p);return
            except PermissionError:
                if attempt==49:raise
                time.sleep(.04)
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def valid_cache(path,raw_path,key,source_sha,pcm_sha):
    try:
        prior=read(path)
        if not isinstance(prior,dict):return None
        return prior if prior.get('cacheKey')==key and prior.get('sourceSha256')==source_sha and prior.get('pcmSha256')==pcm_sha and sha(raw_path)==prior.get('rawSha256') and isinstance(prior.get('events'),list) and digest(prior['events'])==prior.get('eventsSha256') else None
    except (OSError,ValueError,KeyError,TypeError):return None
def recover_source_metadata(folder):
    # Metadata recovery is persistence, not a change to numerical transforms.
    path=folder/'source.json'
    if not path.exists():return
    try:
        value=read(path)
        if not isinstance(value,dict) or not all(isinstance(value.get(k),str) and len(value[k])==64 for k in ['decodedPcmSha256','canonicalWavSha256']):raise ValueError('Incomplete source cache identity')
    except (OSError,ValueError,TypeError):
        os.replace(path,folder/('source-invalid-'+str(time.time_ns())+'.json'))
def contracts():
    inference=module('frozen_inference','scripts/run-beat-v2-inference.py')
    identities={k:inference.evidence.identity(v) for k,v in {'A':'BASE','B':'C1','C':'C2-separated','separator':'first-separator'}.items()}
    # Version the numerical contract, not UI/status serialization. Persistence
    # repairs cannot create a new detector experiment or invalidate good logits.
    return inference,{'version':1,'preparationContractVersion':1,'identities':identities,'executionSourceSha256':{p:sha(p) for p in ['scripts/run-beat-v2-inference.py','scripts/beat-v2-baseline-bridge.mjs','scripts/separate-beat-v2-inputs.py','scripts/full-song-numerics.py']},'decoder':{'soundfile':sf.__version__,'libsndfile':sf.__libsndfile_version__,'resampling':'librosa soxr_hq','sampleRate':44100,'channels':2},'separation':{'shifts':1,'split':True,'overlap':.25,'threads':4,'seed':'decoded PCM SHA first 8 hex','normalization':'official mono mean/std'},'chunking':'No external detector chunks. Whole-song frontend and bidirectional OAF context retained. HTDemucs uses its official split/overlap.'}
def run(job):
    folder=Path(job['folder']).resolve();source=Path(job['source']);folder.mkdir(parents=True,exist_ok=True)
    state={'version':1,'sourceSha256':sha(source),'state':'PREPARING','models':{m:{'state':'WAITING','progress':0} for m in ['A','C','B']},'startedAt':time.time(),'current':'Decoding full recording'}
    def progress(**change):state.update(change);write(folder/'status.json',state)
    progress()
    if state['sourceSha256']!=folder.name:raise ValueError('Original source bytes no longer match their registered SHA-256')
    inference,contract=contracts();contract_sha=digest(contract)
    # A watchdog bounds this worker and its child feature/classification process.
    def watchdog():
        while True:
            process=psutil.Process();blocked=None
            try:
                total=process.memory_info().rss
                for child in process.children(recursive=True):
                    try:total+=child.memory_info().rss
                    except psutil.NoSuchProcess:pass
                if total>6*1024**3 or time.time()-state['startedAt']>3600:blocked='Preparation exceeds 6 GiB resident memory or one-hour job limit.'
            except psutil.Error as error:blocked='Resource monitoring failed: '+str(error)
            if blocked:
                try:progress(state='BLOCKED',error=blocked+' No substitute predictions used.')
                finally:
                    try:
                        for child in process.children(recursive=True):
                            try:child.terminate()
                            except psutil.Error:pass
                    finally:os._exit(75)
            time.sleep(.5)
    threading.Thread(target=watchdog,daemon=True).start()
    numerics=module('full_song_numerics','scripts/full-song-numerics.py')
    recover_source_metadata(folder)
    y,sr,duration,pcm_sha,wav_sha,canonical,audio_identity=numerics.canonical_audio(source,folder,job['filename'],state['sourceSha256'],contract,contract_sha,write)
    progress(source=audio_identity,current='Verified canonical audio; preparing frozen models',contract=contract,contractSha256=contract_sha)
    for label,lane in [('A','BASE'),('C','C2-separated'),('B','C1')]:
        key=digest({'source':state['sourceSha256'],'pcm':pcm_sha,'contract':contract_sha,'model':label})
        cache=folder/'models'/key;cache.mkdir(parents=True,exist_ok=True);result_path=cache/'record.json';raw_path=cache/'raw.json';out=cache/'inference.json'
        prior=valid_cache(result_path,raw_path,key,state['sourceSha256'],pcm_sha)
        if prior:
            write(folder/(label+'.json'),prior)
            state['models'][label]={'state':'READY','progress':1,'reused':True,'cacheKey':key,'resultSha256':sha(result_path),'seconds':prior['seconds']};progress(current=label+' reused exact successful cache');continue
        state['models'][label]={'state':'RUNNING','progress':.05,'reused':False};progress(current=label+' loading verified frozen weights')
        began=time.perf_counter()
        try:
            item={'id':'full-'+state['sourceSha256'],'path':str(canonical),'sha256':wav_sha};separator=None
            if label=='C':
                def separator_progress(amount,message):
                    state['models'][label]['progress']=amount;progress(current=message)
                stem,separator=numerics.drum_stem(y,sr,folder,key,pcm_sha,contract,separator_progress,write);item.update(path=str(stem),sha256=sha(stem))
            model=inference.load(lane);result=inference.infer(lane,model,item,out);del model
            events,raw=numerics.prediction_tracks(label,result,out,duration,state['sourceSha256'],key);write(raw_path,raw)
            record={'version':1,'model':label,'lane':lane,'cacheKey':key,'sourceSha256':state['sourceSha256'],'pcmSha256':pcm_sha,'contract':contract,'events':events,'eventsSha256':digest(events),'rawSha256':sha(raw_path),'rawFile':raw_path.relative_to(folder).as_posix(),'producingWorkerSha256':sha(__file__),'seconds':time.perf_counter()-began,'separator':separator,'coverage':{'start':0,'end':duration,'invalidIntervals':[],'externalChunkJoins':[],'context':'Original full-input context retained; no independent OAF chunks'},'modelMetadata':{k:v for k,v in result.items() if k not in ['rawEvents','events','publishedResult']}}
            write(result_path,record);write(folder/(label+'.json'),record);state['models'][label]={'state':'READY','progress':1,'cacheKey':key,'resultSha256':sha(result_path),'reused':False,'seconds':record['seconds']};progress(current=label+' full recording ready')
        except Exception as error:
            state['models'][label]={'state':'BLOCKED','progress':0,'error':str(error)};progress(current=label+' BLOCKED; other models continue')
    progress(state='READY' if all(v['state']=='READY' for v in state['models'].values()) else 'PARTIAL',finishedAt=time.time(),current='Preparation finished; readiness is explicit per model')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--job');parser.add_argument('--identity',action='store_true');args=parser.parse_args()
    if args.identity:
        _,contract=contracts();print(json.dumps({'contractSha256':digest(contract)}));sys.exit(0)
    if not args.job:parser.error('--job is required')
    try:run(read(args.job))
    except Exception as error:
        job=read(args.job);target=Path(job['folder'])/'status.json';state=read(target) if target.exists() else {};state.update(state='BLOCKED',error=str(error));write(target,state);raise
