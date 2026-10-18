"""One predeclared, reversible score-veto experiment; no inference or fitting."""
import hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
import numpy as np
ROOT=Path.cwd();OUT=ROOT/'scratch/hat-recovery';V2=ROOT/'scratch/beat-grid-v2'
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):Path(path).write_text(json.dumps(value,indent=2),encoding='utf-8')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
core=module('hat_core','scripts/hat-recovery-core.py');scoring=module('hat_score','scripts/score-beat-v2-round.py')
protocol=read(OUT/'mitigation-protocol.json');assert protocol['margin']==.1;variant=protocol['id'];manifest=read(V2/'corpus-manifest.json');contract=scoring.evidence.identity('C1');scored=[];provisional=[]
for item in manifest['items']:
 path=V2/'results/C1'/(item['id']+'.json');r=read(path);scoring.evidence.validate(r,item,contract,path.with_suffix('.npz'));probs=core.sigmoid(np.load(path.with_suffix('.npz'))['logits'])
 start=item.get('analysisStart',0);end=item.get('analysisEnd',item['duration']);baseline=[t for t in core.cnn_edges(probs) if start<=t<end];candidate=[t for t in baseline if core.snare_dominance_keep(probs,t)]
 if not item['scoreEligible']:provisional.append({'id':item['id'],'baselineHatCount':len(baseline),'candidateHatCount':len(candidate),'officialMetrics':False});continue
 assert item['referenceStatus'] in ['deterministic-synthetic-reference','published-independent-dataset-reference'];refs=[e['time'] for e in item['references'] if e['row']=='hat' and start<=e['time']<end]
 scored.append({'id':item['id'],'kind':item['kind'],'domain':item['domain'],'partition':item['partition'],'baseline':core.reference_metrics(refs,baseline,scoring.match,end-start,.05 if item['kind']=='independent-natural-reference' else .04),'candidate':core.reference_metrics(refs,candidate,scoring.match,end-start,.05 if item['kind']=='independent-natural-reference' else .04)})
groups={}
for key in sorted({(s['kind'],s['partition'],s['domain']) for s in scored}):
 selected=[s for s in scored if (s['kind'],s['partition'],s['domain'])==key];groups[' / '.join(key)]={m:core.aggregate_metrics([s[m] for s in selected]) for m in ['baseline','candidate']}
view=read(OUT/'view-data.json');natural={}
for case in view['cases']:
 identifier=case['source'];path=OUT/(identifier+'.json');clip=read(path);raw=read(OUT/('raw-'+identifier+'.json'));probs=np.asarray(raw['B']['scores']);original=clip['tracks']['B']['events'];hats=[e for e in original if e['instrument']=='hat'];kept=[e for e in hats if core.snare_dominance_keep(probs,e['sourceTime'])];rejected=[e for e in hats if not core.snare_dominance_keep(probs,e['sourceTime'])]
 natural[case['id']]={'sourceSha256':identifier,'start':case['start'],'end':case['end'],'baselineHatCount':sum(case['start']<=e['sourceTime']<case['end'] for e in hats),'candidateHatCount':sum(case['start']<=e['sourceTime']<case['end'] for e in kept),'rejectedEvents':[{**e,'sameFrameScores':probs[round(e['sourceTime']/core.CNN_STEP)].tolist()} for e in rejected if case['start']<=e['sourceTime']<case['end']],'officialMetrics':case['id']=='S1-control','referenceStatus':case['referenceStatus']}
 clip['tracks'][variant]={'label':'Experimental B Hat: Snare ≥ Hat +0.10 veto · NOT ACCEPTED','baseline':False,'events':[{**e,'id':variant+':'+e['id'],'originPredictionId':e['id'],'originModel':'B','variantId':variant} for e in kept]};write(path,clip)
reference=read(OUT/'sequence/reference.json');probs=core.sigmoid(np.load(OUT/'sequence/B.npz')['logits']);kept=[t for t in core.cnn_edges(probs) if core.snare_dominance_keep(probs,t)];cycles=[]
for c in reference['cycles']:
 refs=[r['time'] for r in reference['references'] if r['row']=='hat'];cycles.append({**c,**core.cycle_metrics(refs,kept,c['start'],c['end'],scoring.match)})
result={'variantId':variant,'protocol':protocol,'protocolSha256':sha(OUT/'mitigation-protocol.json'),'groups':groups,'perInput':scored,'provisionalDiagnostics':provisional,'naturalCases':natural,'sequenceCycles':cycles,'acceptedDefault':False,'status':'NOT_ACCEPTED','reason':'Exploratory multi-label score veto; inspect dense/overlap losses and pending independent Nujabes positive recall. No production or baseline change.'};write(OUT/'mitigation-results.json',result)
view['mitigation']={k:v for k,v in result.items() if k not in ['perInput','sequenceCycles']};write(OUT/'view-data.json',view)
binding=read(OUT/'view-manifest.json');binding['files']={p:sha(OUT/p) for p in binding['files']};binding['mitigationProducerSha256']=sha(__file__);write(OUT/'view-manifest.json',binding)
for path,expected in read(OUT/'freeze.json')['files'].items():assert sha(ROOT/path)==expected
print(json.dumps({'status':result['status'],'negative':natural['N1']['candidateHatCount'],'MDB':groups['independent-natural-reference / locked-holdout / full-mix'],'dense':[{k:s[k] for k in ['id','baseline','candidate']} for s in scored if s['id']=='dense-hats-under-loud-drums']}))
