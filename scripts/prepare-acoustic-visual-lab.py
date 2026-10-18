"""Derive private listening data from verified evidence; never run a detector."""
import hashlib,json,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

root=Path('scratch/beat-grid-v2');out=Path('scratch/acoustic-visual-lab');out.mkdir(exist_ok=True)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
receipt=read(root/'final-revision.json')
assert receipt['finalRevision']=='36e723b8d2c4181fcc173c7dc2fe1d4b9408b77c'
for file,expected in receipt['artifactSha256'].items():assert sha(root/file)==expected,('Changed historical artifact',file)
# Benchmark code must match the old receipt in the working tree. The owning
# documentation may link this new lab; verify its historical blob separately.
documentation_changes=[]
for file,expected in receipt['sourceFileSha256'].items():
    current=Path(file).read_bytes()
    if file=='docs/beat-event-cache.md' and hashlib.sha256(current).hexdigest()!=expected:
        frozen=subprocess.check_output(['git','show',receipt['finalRevision']+':'+file])
        # The frozen receipt hashes Windows checkout bytes; Git stores LF.
        checkout=frozen.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
        assert expected in (hashlib.sha256(frozen).hexdigest(),hashlib.sha256(checkout).hexdigest()),('Changed historical documentation blob',file)
        documentation_changes.append({'path':file,'frozenSha256':expected,'frozenGitBlobSha256':hashlib.sha256(frozen).hexdigest(),'currentSha256':hashlib.sha256(current).hexdigest(),'scope':'Documentation link only; benchmark sources unchanged'})
    else:assert hashlib.sha256(current).hexdigest()==expected,('Changed historical evaluation source',file)
manifest=read(root/'corpus-manifest.json');records={}
for r in read(root/'result-receipts.json'):
    path=root/'results'/r['lane']/(r['id']+'.json');assert sha(path)==r['recordSha256']
    records[r['lane'],r['id']]=read(path)
lanes={'A':'BASE','B':'C1','C':'C2-separated'}
names={'A':'Frozen ADTOF baseline','B':'Frame-Level Drum CNN','C':'Corrected OAF + HTDemucs'}
ids=['trap','W1','W2','W3','mono','snare-only','hat-only','simultaneous-kick-snare-hat','alternating-snare-hat','weak-strong-hat','dense-hats-under-loud-drums']
clips=[];models={}
for item in manifest['items']:
    if item['id'] not in ids:continue
    y,sr=sf.read(item['path'],dtype='float32',always_2d=True);assert sr==44100
    assert sha(item['path'])==item['sha256']
    assert hashlib.sha256(y.astype('<f4').tobytes()).hexdigest()==item['decodedPcmSha256']
    natural=item['kind']=='natural-music';offset=item['sourceStart']-item['leadingSilenceSeconds'] if natural else 0
    start=item['analysisStart'] if natural else 0;end=item['analysisEnd'] if natural else item['duration']
    if natural:
        exact=y[round(start*sr):round(end*sr)]
        assert hashlib.sha256(exact.astype('<f4').tobytes()).hexdigest()==item['sourcePcmSha256'],('Source excerpt origin',item['id'])
    clip={'id':item['id'],'title':item.get('sourceFilename',item['id']),
      'originalSourceSha256':item.get('sourceSha256',item['sha256']),'canonicalWavSha256':item['sha256'],
      'decodedPcmSha256':item['decodedPcmSha256'],'sampleRate':sr,'duration':item['duration'],
      'sourceOffset':offset,'start':start+offset,'end':end+offset,'natural':natural,
      'mapping':{'sourceTime':'canonicalSample / 44100 + sourceOffset','offsetSeconds':offset,
        'paddingSamples':round(item.get('leadingSilenceSeconds',0)*sr),'manualCandidateShiftSeconds':0,
        'exactUnpaddedPcmSha256':item.get('sourcePcmSha256'),'separatorLengthPreserved':True},
      'audioUrl':'/lab/audio/'+item['id']+'.wav','predictions':{},'raw':{},
      'constructedReferences':item['references'] if item['scoreEligible'] else []}
    for label,lane in lanes.items():
        record=records.get((lane,item['id']))
        if not record:
            clip['predictions'][label]=None;clip['raw'][label]=None;continue
        models[label]={'name':names[label],'lane':lane,'modelSha256':record['evidenceIdentity']['contract']['modelSha256'],
          'pipelineFingerprint':record.get('semanticCompatibility',{}).get('compatibleCurrentFingerprint',record['evidenceIdentity']['fingerprint'])}
        events=[]
        for index,event in enumerate(record['events']):
            if not start<=event['time']<end:continue
            instrument='grouped-percussion' if label=='C' and event['instrument']=='hat' else event['instrument']
            events.append({**event,'instrument':instrument,'sourceTime':event['time']+offset,
              'id':f'{item["id"]}:{label}:{index}','rawIndex':index,'recordSha256':sha(root/'results'/lane/(item['id']+'.json'))})
        clip['predictions'][label]=events
        if label=='A' and record.get('reusedEvidence'):
            raw=read(record['reusedEvidence']['trace'])['activations']
            clip['raw'][label]={'classes':['kick','snare','tom','hat','cymbal'],
              'times':[v['audioTime']+offset for v in raw],'scores':[v['scores'] for v in raw],
              'scope':'Saved frame activations, not probabilities of acoustic correctness; extraction decisions require original classifier evidence.'}
        else:
            saved=np.load(root/'results'/lane/(item['id']+'.npz'))
            if label=='A':times=saved['times']+offset;scores=saved['scores'];classes=['kick','snare','tom','hat','cymbal']
            elif label=='B':
                scores=1/(1+np.exp(-np.clip(saved['logits'],-80,80)));times=np.arange(len(scores))*256/22050+offset;classes=['kick','snare','hat']
            else:scores=saved['onset'];times=np.arange(len(scores))*.01+offset;classes=['kick','snare','tom','grouped-percussion','cymbal','cymbal','cymbal','other']
            clip['raw'][label]={'classes':classes,'times':np.asarray(times).tolist(),'scores':np.asarray(scores).tolist(),
              'scope':'Saved neural output before event extraction; uncalibrated. B uses the published sigmoid. C retains coarse grouped Hat target.'}
        if record.get('firstSeparator'):
            stem=record['firstSeparator'];separated,_=sf.read(stem['path'],dtype='float32',always_2d=True)
            assert len(separated)==len(y),'Separator changed sample origin/length'
    clips.append(clip)
clips.sort(key=lambda c:ids.index(c['id']))
oldVisual=Path('scratch/hat-playback-discrepancy/renderer-results.json')
payload={'version':1,'private':True,'notice':'PRIVATE DIAGNOSTIC — UNVERIFIED MODEL PREDICTIONS',
  'frozenRevision':receipt['finalRevision'],'models':models,'clips':clips,
  'limitations':['Offline replay bypasses live detector/transport/controller.','OAF grouped percussion does not establish true Hi-Hat.',
    'AudioContext and DOM timing are not physical speaker-to-pixel proof.','Annotations start empty and unverified; user review is required.'],
  'priorVisualEvidenceSha256':sha(oldVisual)}
(out/'lab-data.json').write_text(json.dumps(payload),encoding='utf-8')
verification={'status':'PASS','historicalRevision':receipt['finalRevision'],'historicalReceiptSha256':sha(root/'final-revision.json'),
 'verifyOnlyLogSha256':sha(root/'diagnostic-reuse-verification.log'),'historicalArtifacts':receipt['artifactSha256'],
 'resultCount':len(records),'newNeuralExecutions':0,'manualTimeShifts':0,'documentationChanges':documentation_changes,'derivedDataSha256':sha(out/'lab-data.json'),
 'sourceMappings':[{k:c[k] for k in ['id','originalSourceSha256','canonicalWavSha256','decodedPcmSha256','mapping']} for c in clips],
 'priorRendererEvidenceSha256':sha(oldVisual)}
(out/'reuse-verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
print(json.dumps({'clips':len(clips),'verifiedHistoricalResults':len(records),'newNeuralExecutions':0}))
