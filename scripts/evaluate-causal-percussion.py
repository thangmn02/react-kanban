"""Private controls, bounded cache ranges and independent annotation inputs."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import time
import numpy as np
import onnxruntime as ort
import soundfile as sf

spec = importlib.util.spec_from_file_location('controls', Path(__file__).with_name('evaluate-learned-percussion.py'))
controls = importlib.util.module_from_spec(spec); spec.loader.exec_module(controls)
ROOT = Path(__file__).resolve().parents[1]


def events(scores):
    found = {}
    for i in range(1, len(scores)-1):
        for c, row in ((0,'kick'),(1,'snare'),(3,'hat'),(4,'hat')):
            value = float(scores[i,c])
            if value < .5 or value <= scores[i,5] or value <= scores[i-1,c] or value < scores[i+1,c]: continue
            key = (i,row)
            event = {'type':row,'time':i*.01,'confidence':value,'classMargin':value-float(scores[i,5]),
                     'origin':'causal-learned-percussion','semantic':True}
            if key not in found or value > found[key]['confidence']: found[key] = event
    return sorted(found.values(), key=lambda e:(e['time'],e['type']))


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--output',required=True); args=parser.parse_args()
    output=Path(args.output); output.mkdir(parents=True,exist_ok=True); (output/'audio').mkdir(exist_ok=True)
    cases=json.loads((ROOT/'src-tauri/target/learned-percussion/inputs.json').read_text(encoding='utf-8'))
    caravan=Path.home()/'Downloads/Caravan.mp3'
    if caravan.exists(): cases.append({'track':'caravan','files':[str(caravan)],'duration':30,'identity':'jazz full mix — unannotated'})
    processor=controls.LearnedPercussion(onnx_path=ROOT/'src-tauri/target/learned-percussion/model/percussion.onnx')
    options=ort.SessionOptions(); options.intra_op_num_threads=1
    session=ort.InferenceSession(str(output/'model/percussion.onnx'), options, providers=['CPUExecutionProvider'])
    selection=['mono-drum-free-intro','reported-drum-free-intro','lee_hi_hskt-E','nujabes-E','levels','hysteria',
               'voodoo_people','chan_ai_remix-E','take_five','xo_tour_llif3','yellow','redbone','one_more_time',
               'weightless','gymnopedie','chinese_pop-E','50_cuoc_goi_nho','khong_buong','nhuc_tiem_thuc','be_oi_remix',
               'nujabes-A','nujabes-B','nujabes-C','nujabes-guitar-only','lee_hi_hskt-C','caravan']
    manifest=[]; results=[]; annotations=[]; streaming_error=0
    for case in cases:
        mono=controls.audio(case); began=time.perf_counter(); features=processor.features(mono).astype(np.float32)
        prep=(time.perf_counter()-began)*1000
        scores=np.zeros((len(features),6),dtype=np.float32); runtimes=[]
        for end in range(2,len(features)+2,2):
            start=end-100; block=np.zeros((100,84,1),dtype=np.float32); a,b=max(0,start),min(end,len(features))
            block[a-start:b-start]=features[a:b]
            began=time.perf_counter(); prediction=session.run(None,{'audio':block[None]})[0][0]
            runtimes.append((time.perf_counter()-began)*1000); scores[max(0,end-2):b]=prediction[98:98+b-max(0,end-2)]
        # Match the live startup's silence history, including learned biases.
        padded=np.concatenate([np.zeros((100,84,1),dtype=np.float32),features])
        whole=session.run(None,{'audio':padded[None]})[0][0][100:]
        streaming_error=max(streaming_error,float(np.max(np.abs(whole-scores))))
        duration=len(mono)/44100
        record={'input':case['track'],'role':case.get('role','corpus'),'duration':duration,'events':events(scores),
                'preprocessingMs':prep,'runtimeMedianMs':float(np.median(runtimes)),'runtimeP95Ms':float(np.percentile(runtimes,95)),
                'split':'calibration' if case.get('family') in ('lee_hi_hskt','chan_ai_remix','chinese_pop')
                    or case['track'].startswith(('lee_hi_hskt','chan_ai_remix','chinese_pop','hskt-')) else 'holdout'}
        record['counts']={row:sum(e['type']==row for e in record['events']) for row in ('kick','snare','hat')}
        results.append(record)
        np.save(output/(case['track']+'-scores.npy'),scores)
        if case['track'] in selection:
            excerpt=mono[:round(min(duration,20)*44100)]; sf.write(output/'audio'/(case['track']+'.wav'),excerpt,44100)
            manifest.append({'input':case['track'],'duration':len(excerpt)/44100,'file':case['track']+'.wav','split':record['split'],
                             'identity':case.get('identity','full mix'),'role':record['role']})
            annotations.append({'input':case['track'],'start':0,'end':len(excerpt)/44100,'origin':'human','verified':False,
                                'rows':{'kick':None,'snare':None,'hat':None}})
            # Cache the previously evaluated teacher range, never whole assets.
            teacher_path=ROOT/'src-tauri/target/percussion-latency/batch-check'/(case['track']+'-5-10-scores.npy')
            teacher=np.load(teacher_path) if teacher_path.exists() else processor.activations(features)
            cached=controls.percussion_events(teacher,duration)
            asset={'provider':'soundcloud','id':'private-local/'+case['track']}
            key=hashlib.sha256(('1:'+asset['provider']+':'+asset['id']).encode()).hexdigest()
            cache=output/'cache'/key; cache.mkdir(parents=True,exist_ok=True)
            limit=len(excerpt)/44100
            normalized=[{'eventId':f"private:{e['type']}:{round(e['time']*100)}",'type':e['type'],'playbackTime':e['time'],
                         'confidence':e['confidence'],'duration':0,'source':'server-cache'} for e in cached if e['time']<limit]
            normalized.extend({'eventId':f'private:bass:{i}','type':'bass','playbackTime':t,'confidence':1,
                               'duration':0,'source':'server-cache'} for i,t in enumerate(case.get('baseline',{}).get('bass',[])) if t<limit)
            normalized.sort(key=lambda e:(e['playbackTime'],e['type']))
            revision=hashlib.sha256(json.dumps(normalized).encode()).hexdigest()
            chunk={'schemaVersion':2,'revision':revision,'index':0,'events':normalized}
            view={'schemaVersion':2,'asset':asset,'analysisVersion':'private-adtof-range-v1','timelineId':'vod',
                  'duration':limit,'chunkSeconds':30,'melodyPolicy':'dominant-monophonic','requestedRange':{'start':0,'end':limit},
                  'chunks':[{'index':0,'revision':revision}],'analysisState':'completed'}
            (cache/'0.json').write_text(json.dumps(chunk)); (cache/'manifest.json').write_text(json.dumps(view))
        (output/'results.json').write_text(json.dumps(results))
        print(json.dumps({k:v for k,v in record.items() if k!='events'}),flush=True)
    (output/'audio/manifest.json').write_text(json.dumps(manifest))
    (output/'annotations.template.json').write_text(json.dumps(annotations,indent=2))
    (output/'streaming-parity.json').write_text(json.dumps({'maxError':streaming_error,'futureModelFrames':0}))
    if streaming_error>1e-5: raise RuntimeError('Streaming and offline causal scores differ')


if __name__=='__main__': main()
