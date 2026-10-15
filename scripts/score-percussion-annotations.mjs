// Human-labelled local excerpts only. Model predictions are never ground truth.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function temporalMatch(reference, predicted, tolerance = .05) {
  const a = [...reference].sort((x,y)=>x-y), b = [...predicted].sort((x,y)=>x-y);
  // Sorted interval matching maximizes one-to-one matches; no hit is reused.
  let i=0,j=0; const errors=[];
  while(i<a.length && j<b.length) {
    if(b[j]<a[i]-tolerance){j++;continue;}
    if(b[j]>a[i]+tolerance){i++;continue;}
    errors.push(b[j++]-a[i++]);
  }
  const tp=errors.length,fp=b.length-tp,fn=a.length-tp;
  const precision=b.length?tp/b.length:null,recall=a.length?tp/a.length:null;
  return {tp,fp,fn,precision,recall,f1:2*tp+fp+fn?2*tp/(2*tp+fp+fn):null,timingErrorsMs:errors.map(e=>e*1000)};
}

export function scoreAnnotations(annotations, predictions) {
  return annotations.map(a=> {
    if(a.referenceStatus==='provisional-human-reference' || a.purpose==='investigation-only')
      return {input:a.input,status:'provisional-human-reference',scoringEligible:false};
    // A wrong-flash marker is not a complete list of audible onsets.
    if(a.purpose!=='audible-onset-reference') return {input:a.input,status:'not-complete-onset-reference'};
    if(a.verified!==true || a.origin!=='human') return {input:a.input,status:'awaiting-independent-annotation'};
    // A review-page completeness checkbox cannot establish timing accuracy or
    // independence. Official scoring needs a separate, source-bound review.
    if(a.referenceStatus!=='verified-ground-truth') return {input:a.input,status:'awaiting-separate-verification'};
    const verification=a.verification;
    if(verification?.coverage!=='complete-all-rows' || verification.independentOfPredictions!==true
      || !Number.isFinite(verification.onsetUncertaintyMs) || verification.onsetUncertaintyMs<0 || verification.onsetUncertaintyMs>10
      || typeof verification.reviewer!=='string' || !verification.reviewer.trim()
      || typeof verification.method!=='string' || !verification.method.trim()
      || !/^[a-f0-9]{64}$/.test(a.sourceSha256||'') || !/^[a-f0-9]{64}$/.test(a.pcmSha256||'')
      || a.ambiguous!==undefined && !Array.isArray(a.ambiguous)
      || a.ambiguousIntervals!==undefined && !Array.isArray(a.ambiguousIntervals)
      || a.ambiguous?.length || a.ambiguousIntervals?.length)
      return {input:a.input,status:'incomplete-verification-evidence'};
    const prediction=predictions.find(p=>p.input===a.input);
    if(!prediction || prediction.sourceSha256!==a.sourceSha256 || prediction.pcmSha256!==a.pcmSha256)
      throw new Error('Reference and prediction audio identities must match');
    if(!prediction || !Number.isFinite(a.start) || !Number.isFinite(a.end) || a.start<0 || a.end<=a.start || a.end>prediction.duration) throw new Error('Invalid annotated range');
    const rows={};
    for(const row of ['kick','snare','hat']) {
      const reference=a.rows?.[row];
      if(!Array.isArray(reference)||!reference.every(t=>Number.isFinite(t)&&t>=a.start&&t<a.end)
        || new Set(reference).size!==reference.length) throw new Error('Complete unique typed annotations required');
      const events=prediction.events.filter(e=>e.type===row && e.time>=a.start && e.time<a.end);
      rows[row]={...temporalMatch(reference,events.map(e=>e.time)),
        falseEventsPerAbsentMinute:reference.length===0?events.length/((a.end-a.start)/60):null};
    }
    return {input:a.input,status:'human-verified',rows};
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values}=parseArgs({options:{annotations:{type:'string'},predictions:{type:'string'},output:{type:'string'}}});
  if(!values.annotations||!values.predictions||!values.output) throw new Error('Required: --annotations --predictions --output');
  const result=scoreAnnotations(JSON.parse(await readFile(values.annotations,'utf8')),JSON.parse(await readFile(values.predictions,'utf8')));
  await writeFile(values.output,JSON.stringify(result,null,2));console.log(JSON.stringify({verified:result.filter(r=>r.status==='human-verified').length,pending:result.filter(r=>r.status!=='human-verified').length}));
}
