"""Freeze one private corpus before the coordinated inference round."""
import hashlib
import json
import struct
from pathlib import Path
import numpy as np
import soundfile as sf
import soxr

root = Path('scratch/beat-grid-v2')
out = root/'corpus'
out.mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write_float_wave(path,samples):
    samples=np.asarray(samples,dtype='<f4');channels=samples.shape[1];data=samples.tobytes()
    header=b'RIFF'+struct.pack('<I',48+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,3,channels,44100,44100*channels*4,channels*4,32)
    header+=b'fact'+struct.pack('<II',4,len(samples))+b'data'+struct.pack('<I',len(data))
    path.write_bytes(header+data)
previous = json.loads(Path('scratch/xo-percussion-recovery/manifest.json').read_text(encoding='utf-8'))
items = []
for f in previous['fixtures']:
    source = Path('scratch/xo-percussion-recovery')/f['wav']
    assert sha(source) == f['wavSha256']
    target = out/(f['id']+'.wav')
    originalPcm=Path('scratch/xo-percussion-recovery')/f['pcm']
    assert sha(originalPcm)==f['pcmSha256']
    samples=np.fromfile(originalPcm,dtype='<f4').reshape(-1,2)
    write_float_wave(target,samples)
    decoded,_=sf.read(target,dtype='float32',always_2d=True)
    assert hashlib.sha256(decoded.astype('<f4').tobytes()).hexdigest()==f['pcmSha256']
    events = [{**e,'rawClass':e['row']} for e in f.get('events',[])]
    if f.get('sourceFilename'):
        original = Path.home()/'Downloads'/f['sourceFilename']
        assert sha(original) == f['sourceSha256']
    items.append({**f,'path':str(target.resolve()),'sha256':sha(target),'decodedPcmSha256':f['pcmSha256'],'references':events,
      'partition':'development' if f['id'] in ['legacy-snare-only','silence'] else 'locked-holdout',
      'domain':'drum-only' if f['kind']=='controlled-acoustic' else 'full-mix',
      'scoreEligible':f['kind']=='controlled-acoustic',
      'sourceOffsetSeconds':{'trap':44,'W1':7,'W2':59,'W3':94}.get(f['id']),
      'baselineReuse':{'trace':str((Path('scratch/xo-percussion-recovery/baseline-offline')/(f['id']+'.json')).resolve()),
                       'decodedPcmSha256':f['pcmSha256'],
                       'reason':'Decoded float PCM is byte-identical to saved baseline input; same model, frontend and classifier.'}})
data = root/'reference-data'
manifest = json.loads((root/'reference-data-manifest.json').read_text(encoding='utf-8'))
for source in sorted((data/'audio/drum_only').glob('*.wav')):
    track = source.stem.removesuffix('_Drum')
    label = data/'annotations/class'/(track+'_class.txt')
    raw = []
    mapping={'KD':'kick','SD':'snare','HH':'hat','CY':'cymbal','TT':'tom','OT':'other'}
    for line in label.read_text().splitlines():
        time,kind=line.split()
        raw.append({'time':float(time),'row':mapping[kind],'rawClass':kind})
    partition='development' if int(hashlib.sha256(track.encode()).hexdigest()[:8],16)%4==0 else 'locked-holdout'
    for domain,original in [('drum-only',source),('full-mix',data/'audio/full_mix'/(track+'_MIX.wav'))]:
        y,sr=sf.read(original,dtype='float32',always_2d=True)
        y=y[:20*sr]
        if sr!=44100:y=soxr.resample(y,sr,44100,quality='HQ').astype(np.float32)
        if y.shape[1]==1:y=np.repeat(y,2,axis=1)
        target=out/(track+'-'+domain+'.wav')
        write_float_wave(target,y)
        duration=len(y)/44100
        items.append({'id':track+'-'+domain,'path':str(target.resolve()),'sha256':sha(target),
          'sourceSha256':sha(original),'decodedPcmSha256':hashlib.sha256(y.astype('<f4').tobytes()).hexdigest(),'annotationSha256':sha(label),'duration':duration,
          'sampleRate':44100,'channels':2,'domain':domain,'kind':'independent-natural-reference',
          'referenceStatus':'published-independent-dataset-reference','referenceProvenance':
          {'repository':manifest['repository'],'revision':manifest['revision'],'annotationProtocol':'MDB Drums (Southall et al., 2017), semi-automatic/manual review as published; not a new Kora verification'},
          'license':'CC BY-NC-SA 4.0; private research only; no redistribution',
          'partition':partition,'splitGroup':track,'analysisStart':1,'analysisEnd':duration-1,
          'scoreEligible':True,'references':[e for e in raw if 1<=e['time']<duration-1],
          'trainingOverlap':'Unknown for some candidate checkpoints; local holdout is not a claim of global training disjointness.'})
result={'version':1,'frozenBase':'c93046ad262db21577792eed0ee61c3452525328',
 'normalization':'No amplitude normalization. Existing float PCM is preserved exactly in FLOAT WAVs, avoiding quantized review copies; dataset excerpt first20s, soundfile float32, deterministic soxr HQ if needed. All lanes receive identical canonical WAV bytes.',
 'holdoutPolicy':'Partition fixed by track hash before predictions; paired stem/mix stay together. No tuning on results.',
 'items':items,'limitations':['Original MDB labels may contain annotation omissions; metrics are against the published reference, not a new claim of perfect coverage.',
 'IDMT acoustic/electronic isolated reference archive unavailable (HTTP403). Controlled fixtures are synthesized signals; MDB supplies real timbre diversity.',
 'Provisional XO/Whiplash/MONO/listening references are ineligible for official accuracy metrics.']}
(root/'corpus-manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'items':len(items),'sourceGroups':23,'partitions':{p:sum(i['partition']==p for i in items) for p in ['development','locked-holdout']}}))
