"""Score a frozen sweep; provisional human marks never enter the metric path."""
import hashlib
import importlib.util
import json
from collections import Counter,defaultdict
from datetime import datetime
from pathlib import Path
import numpy as np
import yaml
from scipy.optimize import linear_sum_assignment

ROOT=Path('scratch/beat-grid-v2')
LANES=['BASE','C1','C2','C2-separated','C3','C4']
CLASSES=['kick','snare','hat','cymbal','tom']
spec=importlib.util.spec_from_file_location('beat_v2_evidence',Path(__file__).with_name('beat-v2-evidence.py'))
evidence=importlib.util.module_from_spec(spec);spec.loader.exec_module(evidence)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def match(reference,predictions,cap):
    """Maximum-cardinality, then minimum absolute-error one-to-one matching."""
    r=np.asarray(reference,float);p=np.asarray(predictions,float)
    tolerance=np.full(len(r),cap,float)
    if len(r)>1:
        gaps=np.diff(r)
        tolerance[:-1]=np.minimum(tolerance[:-1],gaps/4)
        tolerance[1:]=np.minimum(tolerance[1:],gaps/4)
    if not len(r) or not len(p):return [],tolerance.tolist()
    distance=np.abs(r[:,None]-p[None,:]);valid=distance<=tolerance[:,None]+1e-10
    penalty=(min(len(r),len(p))+1)*(cap+1)
    rows,cols=linear_sum_assignment(np.where(valid,distance,penalty))
    return [{'referenceIndex':int(i),'predictionIndex':int(j),'errorSeconds':float(distance[i,j])}
      for i,j in zip(rows,cols) if valid[i,j]],tolerance.tolist()

def metrics(tp,fp,fn,errors,seconds,dense=(0,0),overlap=(0,0)):
    precision=tp/(tp+fp) if tp+fp else None
    recall=tp/(tp+fn) if tp+fn else None
    return {'tp':tp,'fpAgainstReference':fp,'fnAgainstReference':fn,'precision':precision,'recall':recall,
      'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,
      'absoluteErrorMedianMs':float(np.median(errors)*1000) if errors else None,
      'absoluteErrorP95Ms':float(np.percentile(errors,95)*1000) if errors else None,
      'falseEventsPerMinute':fp/seconds*60 if seconds else None,
      'denseMatched':dense[0],'denseReferenceCount':dense[1],'denseRecall':dense[0]/dense[1] if dense[1] else None,
      'overlapMatched':overlap[0],'overlapReferenceCount':overlap[1],'overlapRecall':overlap[0]/overlap[1] if overlap[1] else None}

def score(item,record,key='instrument'):
    assert item['scoreEligible'] and item['referenceStatus'] in ['deterministic-synthetic-reference','published-independent-dataset-reference']
    start=item.get('analysisStart',0);end=item.get('analysisEnd',item['duration'])
    refs=[e for e in item['references'] if start<=e['time']<end]
    preds=[e for e in record['events'] if start<=e['time']<end]
    output={}
    for cls in CLASSES:
        times=sorted(e['time'] for e in refs if (('hat' if e['row'] in ['hat','cymbal'] else e['row']) if key=='displayRow' else e['row'])==cls)
        simultaneousCollapsed=0
        if key=='displayRow':
            simultaneousCollapsed=len(times)-len(set(times));times=sorted(set(times))
        proposed=sorted(e['time'] for e in preds if e[key]==cls)
        pairs,tolerances=match(times,proposed,.05 if item['kind']=='independent-natural-reference' else .04)
        matched={p['referenceIndex'] for p in pairs}
        dense={i for i,t in enumerate(times) if (i and t-times[i-1]<=.125+1e-9) or (i+1<len(times) and times[i+1]-t<=.125+1e-9)}
        overlap={i for i,t in enumerate(times) if any(e['row']!=cls and e['row'] in ['kick','snare','hat'] and abs(e['time']-t)<=.02 for e in refs)}
        errors=[p['errorSeconds'] for p in pairs]
        output[cls]={**metrics(len(pairs),len(proposed)-len(pairs),len(times)-len(pairs),errors,end-start,
          (len(dense&matched),len(dense)),(len(overlap&matched),len(overlap))),
          'errorsSeconds':errors,'pairs':pairs,'referenceTimes':times,'predictionTimes':proposed,'tolerancesSeconds':tolerances,
          'exactCoincidentReferenceEventsCollapsed':simultaneousCollapsed}
    return {'lane':record['lane'],'id':item['id'],'kind':item['kind'],'partition':item['partition'],'domain':item['domain'],
      'genre':item.get('splitGroup',item['id']).removeprefix('MusicDelta_'), 'seconds':end-start,'labelMode':key,'classes':output,
      'executionBatchSize':record.get('executionBatchSize')}

def aggregate(items):
    output={}
    for cls in CLASSES:
        values=[i['classes'][cls] for i in items]
        output[cls]=metrics(sum(v['tp'] for v in values),sum(v['fpAgainstReference'] for v in values),
          sum(v['fnAgainstReference'] for v in values),[x for v in values for x in v['errorsSeconds']],sum(i['seconds'] for i in items),
          (sum(v['denseMatched'] for v in values),sum(v['denseReferenceCount'] for v in values)),
          (sum(v['overlapMatched'] for v in values),sum(v['overlapReferenceCount'] for v in values)))
    return {'inputs':len(items),'classes':output}

def main():
    manifest=read(ROOT/'corpus-manifest.json');scored=[];listening=[];runtime=[];receipts=[];segments=[]
    frozen=read(ROOT/'round-corpus-freeze.json')
    genreManifest=read(ROOT/'genre-manifest.json');genres={}
    for source in genreManifest['records']:
        assert evidence.sha(source['path'])==source['sha256']
        genres[source['track']]=yaml.safe_load(Path(source['path']).read_text())['genre']
    restart=read(ROOT/'listening-server-restart.json') if (ROOT/'listening-server-restart.json').exists() else None
    assert evidence.sha(ROOT/'corpus-manifest.json')==frozen['manifestSha256']
    for binding in frozen['bindings'].values():
        for file,expected in binding['files'].items():assert evidence.sha(file)==expected,('Changed corpus/reference/replay trace',file)
    for lane in LANES:
        contract=evidence.identity(lane)
        for item in manifest['items']:
            if lane=='C2-separated' and item['domain']!='full-mix':continue
            path=ROOT/'results'/lane/(item['id']+'.json');record=read(path)
            assert record['lane']==lane and record['id']==item['id']
            executed=dict(item)
            if record.get('firstSeparator'):
                separator=record['firstSeparator'];assert evidence.equivalent_input(separator['sourceSha256'],item)
                executed.update(path=separator['path'],sha256=separator['sha256'])
            raw=path.with_suffix('.npz')
            if record.get('rawOutputSha256'):assert raw.exists(),'Missing declared raw model output'
            evidence.validate(record,executed,contract,raw if record.get('rawOutputSha256') else None)
            if record.get('priorRuntimeNotCompared'):
                assert record['rtf'] is None and record['cpuSeconds'] is None
                assert record['reusedEvidence']['trace'] in frozen['bindings'][item['id']]['files']
            receipts.append({'lane':lane,'id':item['id'],'recordSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
              'pipelineFingerprint':record['evidenceIdentity']['fingerprint'],
              'semanticCompatibility':record.get('semanticCompatibility'),'executionBatchSize':record.get('executionBatchSize'),
              'rawEventsSha256':hashlib.sha256(json.dumps(record['rawEvents'],sort_keys=True).encode()).hexdigest()})
            interference=False
            if restart and lane=='C3' and 'affectedResultIds' in restart:
                interference=item['id'] in restart['affectedResultIds']
            elif restart and lane=='C3' and record.get('elapsedSeconds'):
                end=path.stat().st_mtime;start=end-record['elapsedSeconds']
                interference=start<datetime.fromisoformat(restart['at'].replace('Z','+00:00')).timestamp() and end>datetime.fromisoformat(restart['rebuildStartedAt']).timestamp()
            runtime.append({'lane':lane,'id':item['id'],'kind':item['kind'],'domain':item['domain'],'duration':item['duration'],
              'runtimeExcludedForServerRebuild':interference,
              'executionBatchSize':record.get('executionBatchSize'),
              **{k:record.get(k) for k in ['rtf','fullPipelineSeconds','coldLoadSeconds','fullPipelineColdLoadSeconds','cpuSeconds','cpuHostUtilizationPercent',
              'residentPeakBytes','preprocessingSeconds','inferenceSeconds','postprocessingSeconds','priorRuntimeNotCompared']}})
            if item['scoreEligible']:
                for key in ['instrument','displayRow']:
                    view=score(item,record,key)
                    if item.get('splitGroup'):view['genre']=genres[item['splitGroup']]
                    scored.append(view)
                for segment in item.get('segments',[]):
                    excerpt={**item,'analysisStart':segment['start'],'analysisEnd':segment['end']}
                    result=score(excerpt,record);segments.append({**result,'intervalMs':segment['intervalMs']})
            else:
                offset=item['sourceStart']-item.get('leadingSilenceSeconds',0)
                events=[{**e,'sourceTime':e['time']+offset} for e in record['events'] if item['analysisStart']<=e['time']<item['analysisEnd']]
                if item['id']=='trap':events=[e for e in events if 45<=e['sourceTime']<57]
                scores=[e['confidence'] for e in events if 'confidence' in e]
                scoreScope='Uncalibrated model onset activation at proposed events; not probability of acoustic correctness.'
                if lane=='C1':
                    logits=np.load(raw)['logits']
                    scores=[float(1/(1+np.exp(-np.clip(logits[round(e['time']*22050/256),['kick','snare','hihat'].index(e['rawClass'])],-80,80)))) for e in events]
                    scoreScope='Published sigmoid applied to saved logits at rounded onset frames; uncalibrated, not acoustic verification.'
                listening.append({'lane':lane,'id':item['id'],'sourceSha256':item['sourceSha256'],'sourceOffsetSeconds':offset,
                  'referenceStatus':'provisional-human-reference / unverified listening; no P/R/F1 or definite FP/FN',
                  'counts':dict(Counter(e['instrument'] for e in events)),'events':events,
                  'confidenceDistribution':{'min':min(scores),'median':float(np.median(scores)),'max':max(scores)} if scores else None,
                  'scoreScope':scoreScope if scores else 'No event confidence score emitted by this decoder; velocity/stem energy is not substituted.',
                  'ambiguousIntervals':[{'start':min(e['sourceTime'] for e in events) if events else offset,'end':max(e['sourceTime'] for e in events) if events else offset,
                  'status':'acoustic identity and completeness unverified; require independent review'}]})
    groups=defaultdict(list)
    for result in scored:
        groups[(result['lane'],result['kind'],result['partition'],result['domain'],result['labelMode'])].append(result)
    summary=[dict(zip(['lane','kind','partition','domain','labelMode'],key),**aggregate(values)) for key,values in groups.items()]
    byGenre=defaultdict(list)
    for result in scored:
        if result['kind']=='independent-natural-reference' and result['labelMode']=='instrument':
            byGenre[(result['lane'],result['partition'],result['domain'],result['genre'])].append(result)
    genreSummary=[dict(zip(['lane','partition','domain','genre'],key),**aggregate(values)) for key,values in byGenre.items()]
    runtimeSummary=[]
    for lane,batch in [(lane,batch) for lane in LANES for batch in ([8,1] if lane=='C4' else [None])]:
        for domain in ['full-mix','drum-only']:
            selected=[r for r in runtime if r['lane']==lane and r['domain']==domain and r['executionBatchSize']==batch and not r['priorRuntimeNotCompared'] and not r['runtimeExcludedForServerRebuild']]
            if not selected:continue
            runtimeSummary.append({'lane':lane,'domain':domain,'executionBatchSize':batch,'inputs':len(selected),
              'weightedRtf':sum(r['fullPipelineSeconds'] for r in selected)/sum(r['duration'] for r in selected),
              'p95Rtf':float(np.percentile([r['rtf'] for r in selected],95)),
              'coldLoadSeconds':max(r['fullPipelineColdLoadSeconds'] or r['coldLoadSeconds'] for r in selected),
              'peakResidentGiB':max(r['residentPeakBytes'] for r in selected)/1024**3,
              'cpuSeconds':sum(r['cpuSeconds'] for r in selected),
              'hostCpuPercent':sum(r['cpuSeconds'] for r in selected)/sum(r['fullPipelineSeconds'] for r in selected)/16*100})
    output={'protocol':'one-to-one maximum cardinality then minimum absolute error; natural cap50ms, synthetic40ms; per-reference nearest same-class gap/4',
      'manifestSha256':frozen['manifestSha256'],'freezeReceiptSha256':evidence.sha(ROOT/'round-corpus-freeze.json'),
      'genreManifestSha256':evidence.sha(ROOT/'genre-manifest.json'),'genreProvenance':{'repository':genreManifest['repository'],'commit':genreManifest['commit']},
      'c4BatchingParitySha256':evidence.sha(ROOT/'c4-batching-parity.json'),
      'limitations':manifest['limitations'],'summary':summary,'genreSummary':genreSummary,'runtimeSummary':runtimeSummary,
      'scored':scored,'segments':segments,'runtime':runtime,'listening':listening}
    (ROOT/'comparison.json').write_text(json.dumps(output,indent=2))
    (ROOT/'result-receipts.json').write_text(json.dumps(receipts,indent=2))
    print(json.dumps({'records':len(receipts),'scoredViews':len(scored),'unscoredListening':len(listening),'summaryGroups':len(summary)}))

if __name__=='__main__':main()
