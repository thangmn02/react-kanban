"""Compare complete CPU costs on the same uncontaminated natural full mixes."""
import hashlib
import json
from pathlib import Path
import numpy as np

root=Path('scratch/beat-grid-v2')
comparison=json.loads((root/'comparison.json').read_text())
manifest=json.loads((root/'corpus-manifest.json').read_text())
lanes=['BASE','C1','C2','C2-separated','C3','C4']
natural={i['id'] for i in manifest['items'] if i['kind']=='independent-natural-reference' and i['domain']=='full-mix'}
ids=sorted(set.intersection(*[{v['id'] for v in comparison['runtime'] if v['lane']==lane and v['id'] in natural
  and not v['runtimeExcludedForServerRebuild'] and not v['priorRuntimeNotCompared']} for lane in lanes]))
assert ids,'No comparable natural full-mix runtime records'
summary=[]
for lane in lanes:
    rows=[v for v in comparison['runtime'] if v['lane']==lane and v['id'] in ids]
    if lane=='C4':assert all(v['executionBatchSize']==1 for v in rows)
    records=[json.loads((root/'results'/lane/(v['id']+'.json')).read_text()) for v in rows]
    total=sum(v['fullPipelineSeconds'] for v in rows)
    stages={k:sum(v.get(k) or 0 for v in records)/len(records) for k in ['preprocessingSeconds','inferenceSeconds','postprocessingSeconds']}
    stages['firstSeparationSeconds']=sum(v['firstSeparator']['separationSeconds']+
      v['firstSeparator']['overheadMeasurement']['preparationSeconds']+
      v['firstSeparator']['overheadMeasurement']['outputSerializationSeconds'] if v.get('firstSeparator') else 0 for v in records)/len(records)
    summary.append({'lane':lane,'inputs':len(rows),'weightedRtf':total/sum(v['duration'] for v in rows),
      'p95Rtf':float(np.percentile([v['rtf'] for v in rows],95)),
      'coldLoadSeconds':max(v['fullPipelineColdLoadSeconds'] or v['coldLoadSeconds'] for v in rows),
      'peakResidentGiB':max(v['residentPeakBytes'] for v in rows)/1024**3,
      'hostCpuPercent':sum(v['cpuSeconds'] for v in rows)/total/16*100,
      'meanStagesSeconds':stages,'meanFullPipelineSeconds':total/len(rows)})
receipt={'comparisonSha256':hashlib.sha256((root/'comparison.json').read_bytes()).hexdigest(),
  'sameNaturalFullMixIds':ids,'excludedNaturalFullMixIds':sorted(natural-set(ids)),
  'scope':'Matched natural full-mix runtime subset, excludes two C3 rebuild-overlap inputs from all lanes, actual CPU4 float32; C4 batch1 only. Measured sequential-stage sums, not browser/physical latency.',
  'summary':summary}
(root/'runtime-comparison.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({'matchedNaturalFullMixes':len(ids),'lanes':len(summary)}))
