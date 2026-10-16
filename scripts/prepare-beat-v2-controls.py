"""Complete two missing requested controls before inspecting any quality scores."""
import hashlib,json,struct
from pathlib import Path
import numpy as np
root=Path('scratch/beat-grid-v2')
path=root/'corpus-manifest.json';manifest=json.loads(path.read_text())
for name,seed in [('isolated-kick',4106),('dense-hats-under-loud-drums',4107)]:
    if any(i['id']==name for i in manifest['items']):continue
    rng=np.random.default_rng(seed);audio=np.zeros(44100*14,dtype=np.float32);events=[];segments=[]
    for segment,interval in enumerate([20,30,50,80,125,200]):
        start=1+segment*2
        segments.append({'intervalMs':interval,'start':start-.15,'end':start+1.3,'matchingToleranceMs':min(40,interval/4)})
        for hit in range(6):
            onset=round((start+hit*interval/1000)*44100)/44100
            kinds=['kick'] if name=='isolated-kick' else ['hat']+(['kick','snare'] if hit%2==0 else [])
            for kind in kinds:
                level=.16 if kind=='hat' else 1
                events.append({'row':kind,'time':onset,'intervalMs':interval,'level':level})
                length=int(44100*({'kick':.25,'snare':.14,'hat':.06}[kind]));t=np.arange(length)/44100;noise=rng.uniform(-1,1,length)
                if kind=='kick':signal=np.sin(2*np.pi*(55*t+70*.025*(1-np.exp(-t/.025))))*np.exp(-t/.055)
                elif kind=='snare':signal=(noise*.6+np.sin(2*np.pi*180*t)*.25)*np.exp(-t/.035)
                else:signal=(np.diff(noise,prepend=0)*.3+.04*sum(np.sin(2*np.pi*f*t) for f in [4400,6200,8100]))*np.exp(-t/.012)
                index=round(onset*44100);audio[index:index+length]+=np.asarray(signal*.55*level,dtype=np.float32)
    peak=np.max(np.abs(audio))
    if peak>.95:audio*=.95/peak
    pcm=np.repeat(audio[:,None],2,axis=1).astype('<f4');data=pcm.tobytes();target=root/'corpus'/(name+'.wav')
    header=b'RIFF'+struct.pack('<I',48+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,3,2,44100,352800,8,32)
    header+=b'fact'+struct.pack('<II',4,len(audio))+b'data'+struct.pack('<I',len(data));target.write_bytes(header+data)
    manifest['items'].append({'id':name,'path':str(target.resolve()),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
      'decodedPcmSha256':hashlib.sha256(data).hexdigest(),'duration':14,'sampleRate':44100,'channels':2,
      'partition':'locked-holdout','domain':'drum-only','kind':'controlled-acoustic','scoreEligible':True,
      'referenceStatus':'deterministic-synthetic-reference','referenceCoverage':'complete-by-construction',
      'license':'CC0 generated signals','seed':seed,'segments':segments,'references':events,
      'additionReason':'Requested isolated Kick and weak dense Hats under loud Kick/Snare were missing from reused controls; added before quality scoring, without model tuning.'})
manifest['coverageAmendment']='Two missing requested synthetic controls added before quality scoring; all existing source PCM and partitions remain unchanged.'
path.write_text(json.dumps(manifest,indent=2))
print(json.dumps({'corpusInputs':len(manifest['items']),'newControls':2}))
