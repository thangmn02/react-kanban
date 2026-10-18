"""Attach measured browser evidence to the provisional event ledger, never labels."""
import hashlib,json
from pathlib import Path
ROOT=Path.cwd();OUT=ROOT/'scratch/hat-recovery'
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,value):Path(path).write_text(json.dumps(value,indent=2),encoding='utf-8')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
browser=read(OUT/'browser-verification.json');assert browser['status']=='PASS' and not browser['errors']
negative=read(OUT/'negative-ledger.json');runs=[r for r in browser['runs'] if r['case']=='N1']
for event in negative['events']:
 evidence={}
 for run in runs:
  if run['track']!=event['model']:continue
  ids={d['id'] for d in run['deliveries']};delivered=event['predictionId'] in ids
  complete=run['frameIds']==len(run['deliveries'])
  evidence[run['renderer']]={'labDelivered':delivered,'frameObserved':True if delivered and complete else None,'frameIdentityProof':'All unique delivered IDs in this single-pass run were frame-observed' if complete else 'Individual frame identity not retained; aggregate cannot identify this event','humanPerceived':None}
 assert all(e['labDelivered'] for e in evidence.values()) and len(evidence)==2
 event['rendererStatus']='DELIVERED_ORIGINAL_AND_SHORT';event['rendererEvidence']=evidence
negative.update(publicRuntimeAcceptedCount=None,sharedRowCountScope='Saved proposals mapped to the public shared row, not production controller acceptance',humanConfirmedFalseCount=None,rendererRuns=[{k:v for k,v in r.items() if k not in ['deliveries','sharedRowBrightness']} for r in runs],rendererReceiptSha256=sha(OUT/'browser-verification.json'))
write(OUT/'negative-ledger.json',negative)
view=read(OUT/'view-data.json');view['negative']=negative;view['rendererVerification']={'status':'PASS','scope':'Measured lab deliveries, visible-frame identities and shared-row luminance proxies; no perceived attack or physical timing claim','runs':[{k:v for k,v in r.items() if k not in ['deliveries','sharedRowBrightness']} for r in browser['runs']]}
view['decisions']['cnnRecovery']='TRADEOFF UNACCEPTABLE for tested threshold increases and Snare-dominance veto'
view['decisions']['furtherPrivateTesting']='NO-GO: no tested Hat correction qualifies for the next private hybrid evaluation. H0 is routing evidence only.'
write(OUT/'view-data.json',view)
for case in view['cases']:
 path=OUT/(case['source']+'.json');clip=read(path);h=clip['tracks']['H0-frozen-routing-diagnostic-v1'];h['routing']={'kick':'A','snare':'A','hat':'B','cymbalConvertedToHat':False,'kickSnareUnavailableIntervals':clip['coverage']['A']['uncoveredIntervals'],'hatUnavailableIntervals':clip['coverage']['B']['uncoveredIntervals']};write(path,clip)
binding=read(OUT/'view-manifest.json');binding['files']={path:sha(OUT/path) for path in binding['files']};binding['finalizerSourceSha256']=sha(__file__);write(OUT/'view-manifest.json',binding)
for receipt in ['freeze.json','renderer-source-freeze.json']:
 for path,expected in read(OUT/receipt)['files'].items():assert sha(ROOT/path)==expected,('Changed frozen evidence',path)
print(json.dumps({'status':'FINALIZED','N1Events':len(negative['events']),'decision':view['decisions'],'browserRuns':len(browser['runs'])}))
