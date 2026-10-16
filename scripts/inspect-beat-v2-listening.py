"""Locate disputed passages without turning provisional human clicks into truth."""
import hashlib,json
from pathlib import Path
root=Path('scratch/beat-grid-v2');comparison=json.loads((root/'comparison.json').read_text())
old=Path('scratch/whiplash-provisional-investigation/review-cases.json')
previous=json.loads(old.read_text());manifest=json.loads((root/'corpus-manifest.json').read_text())
inputs={i['id']:i for i in manifest['items']}
cases=[]
for case in previous['cases']:
    if case['input'] not in inputs:continue
    if case['input'] not in ['trap','W1','W2','W3','mono']:continue
    item=inputs[case['input']];sourceTime=case['time']+item['sourceStart']
    cases.append({'id':case['id'],'input':case['input'],'row':case['row'],'sourceTime':sourceTime,
      'flags':case.get('flags',[]),'confidence':case['confidence'],'onsetUncertaintyMs':case['onsetUncertaintyMs'],
      'origin':'provisional human annotation, not complete independently verified reference'})
for itemId in ['trap','mono','W1','W2','W3']:
    item=inputs[itemId]
    cases.append({'id':itemId+'-whole-passage','input':itemId,'sourceTime':None,'row':None,
      'origin':'User listening complaint / whole-passage review; no invented onset annotation',
      'interval':[item['sourceStart'],item['sourceEnd']],
      'confidence':{'audibility':'unassessed','instrument':'uncertain','timing':'unverified','coverage':'unknown'}})
for case in cases:
    case.update(referenceStatus='provisional-human-reference',verified=False,scoringEligible=False,
      sourceSha256=inputs[case['input']]['sourceSha256'],reviewStatus='NEEDS INDEPENDENT ACOUSTIC REVIEW')
    case['candidates']=[]
    for row in comparison['listening']:
        if row['id']!=case['input']:continue
        if case['sourceTime'] is None:events=row['events']
        else:events=[e for e in row['events'] if abs(e['sourceTime']-case['sourceTime'])<=.15]
        case['candidates'].append({'lane':row['lane'],'proposals':events})
    case['interpretation']='Proximity is a navigation aid (±150ms), not a verified match. Missing proposals do not establish FN; unmatched predictions do not establish FP.'
output={'sourceAnnotationSha256':previous['sourceAnnotationSha256'],'priorLedgerSha256':hashlib.sha256(old.read_bytes()).hexdigest(),
  'manifestSha256':comparison['manifestSha256'],'officialAccuracyCalculatedFromTheseCases':False,
  'uncertainty':'Instrument identities, onset error bounds and complete coverage remain unverified; no threshold fitted to these clicks.',
  'cases':cases}
(root/'listening-case-ledger.json').write_text(json.dumps(output,indent=2))
print(json.dumps({'provisionalCases':len(cases),'accuracyMetrics':False}))
