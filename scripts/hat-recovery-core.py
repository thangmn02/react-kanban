"""Private, deterministic diagnostics on frozen activations; no baseline mutation."""
import numpy as np

CNN_STEP=256/22050
THRESHOLDS=(.3,.4,.5,.6,.7,.8,.9)

def cnn_edges(probabilities,threshold=.5,column=2):
    active=np.asarray(probabilities)[:,column]>threshold
    return [round(int(i)*CNN_STEP,4) for i in np.flatnonzero(active[1:]&~active[:-1])+1]

def sigmoid(logits):return 1/(1+np.exp(-np.clip(logits,-80,80)))

def variant_id(threshold):return 'cnn-hat-threshold-diagnostic-v1-'+str(round(threshold*100))

def snare_dominance_keep(probabilities,time,margin=.1):
    scores=probabilities[round(time/CNN_STEP)]
    return not scores[1]>=scores[2]+margin

def threshold_track(probabilities,threshold,source_sha):
    return [{'id':f'{variant_id(threshold)}:{source_sha}:{i}', 'sourceTime':time,'time':time,
             'instrument':'hat','rawClass':'hihat','rawIndex':round(time/CNN_STEP),
             'recordSha256':source_sha,'variantId':variant_id(threshold),'baseModel':'B',
             'confidence':float(probabilities[round(time/CNN_STEP),2])}
            for i,time in enumerate(cnn_edges(probabilities,threshold))]

def hypothetical_hybrid(a,b):
    events=[{**e,'originModel':model,'originPredictionId':e['id'],'variantId':'H0-frozen-routing-diagnostic-v1'}
            for model,track in [('A',a),('B',b)] for e in track
            if (model=='A' and e['instrument'] in ['kick','snare']) or (model=='B' and e['instrument']=='hat')]
    # Identity duplicates may be removed; simultaneous different classes coexist.
    unique={(e['originModel'],e['originPredictionId']):e for e in events}
    return sorted(unique.values(),key=lambda e:(e['sourceTime'],e['instrument'],e['id']))

def count_interval(events,start,end):
    selected=[e for e in events if start<=e['sourceTime']<end]
    return {name:sum(e['instrument']==name for e in selected) for name in ['kick','snare','hat','cymbal','grouped-percussion']}

def accepted_run(probabilities,index,threshold=.5,column=2):
    active=probabilities[:,column]>threshold;start=index;end=index
    while start and active[start-1]:start-=1
    while end+1<len(active) and active[end+1]:end+=1
    return {'startFrame':start,'endFrame':end,'frameCount':end-start+1,'seconds':(end-start+1)*CNN_STEP,
            'peakScore':float(np.max(probabilities[start:end+1,column]))}

def reference_metrics(references,predictions,match,seconds,cap=.05):
    pairs,tolerances=match(sorted(references),sorted(predictions),cap);tp=len(pairs);fp=len(predictions)-tp;fn=len(references)-tp
    return {'tp':tp,'fpAgainstReference':fp,'fnAgainstReference':fn,
            'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None,
            'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,'seconds':seconds,'pairs':pairs,'tolerances':tolerances}

def aggregate_metrics(items):
    tp=sum(v['tp'] for v in items);fp=sum(v['fpAgainstReference'] for v in items);fn=sum(v['fnAgainstReference'] for v in items)
    return {'tp':tp,'fpAgainstReference':fp,'fnAgainstReference':fn,'precision':tp/(tp+fp) if tp+fp else None,
            'recall':tp/(tp+fn) if tp+fn else None,'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,
            'seconds':sum(v['seconds'] for v in items),'inputs':len(items)}

def cycle_metrics(references,predictions,start,end,match,cap=.04):
    """Match on the complete track before assigning outcomes to reference cycles."""
    refs=sorted(references);preds=sorted(predictions);pairs,tolerances=match(refs,preds,cap)
    selected={i for i,t in enumerate(refs) if start<=t<end}
    matches=[p for p in pairs if p['referenceIndex'] in selected]
    matched_predictions={p['predictionIndex'] for p in pairs}
    false=[t for i,t in enumerate(preds) if i not in matched_predictions and start<=t<end]
    tp=len(matches);fn=len(selected)-tp;fp=len(false)
    return {'tp':tp,'fpAgainstReference':fp,'fnAgainstReference':fn,
            'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None,
            'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,'seconds':end-start,
            'pairs':matches,'tolerances':[tolerances[i] for i in sorted(selected)],
            'acceptedMatchedTimes':[preds[p['predictionIndex']] for p in matches],
            'unmatchedPredictionTimes':false}
