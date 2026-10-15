// Investigation only: proximity to a human mark is never musical correctness.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { PercussionClassifier } from '../extensions/kanban-music/percussion-classifier.js';

const rowClasses = { kick: [0], snare: [1], hat: [3, 4] };
const bandRow = band => band === 'clap' ? 'snare' : band;

export function provisionalReference(annotation, fixture) {
  if(annotation.sourceSha256!==fixture.sourceSha256 || annotation.pcmSha256!==fixture.pcmSha256
    || annotation.sourceStart!==fixture.sourceStart || annotation.sourceEnd!==fixture.sourceEnd
    || annotation.start!==0 || annotation.end!==fixture.duration) throw Error('Annotation audio or interval mismatch');
  const observations = [], rows = {};
  for(const row of Object.keys(rowClasses)) {
    const draft = annotation.draft?.[row];
    const times = typeof draft==='string' && draft.trim() ? draft.trim().split(/[\s,]+/).map(Number)
      : Array.isArray(annotation.provisionalRows?.[row]) ? annotation.provisionalRows[row]
        : Array.isArray(annotation.rows?.[row]) ? annotation.rows[row] : [];
    const seen = new Set();
    rows[row] = times.length ? [...times] : null;
    for(const [index,time] of times.entries()) {
      if(!Number.isFinite(time)) throw Error('Non-finite provisional timestamp; inspect original draft');
      const flags = [];
      if(time<0 || time>=fixture.duration) flags.push('outside-half-open-excerpt');
      if(seen.has(time)) flags.push('repeated-human-mark');
      seen.add(time);
      observations.push({ id:`${fixture.input}:${row}:${index+1}`, row, time, flags,
        confidence:{audibility:'unassessed',instrument:'uncertain',timing:'unverified',
          rowSelfReport:annotation.rowConfidence?.[row]||'unassessed'},
        onsetUncertaintyMs:Number.isFinite(annotation.onsetUncertaintyMs)?annotation.onsetUncertaintyMs:null });
    }
  }
  return {input:fixture.input,start:0,end:fixture.duration,origin:'human',
    referenceStatus:'provisional-human-reference',purpose:'investigation-only',verified:false,
    scoringEligible:false,rows,observations,sourceSha256:fixture.sourceSha256,pcmSha256:fixture.pcmSha256,
    sourceStart:fixture.sourceStart,sourceEnd:fixture.sourceEnd,
    coverage:'unknown',ambiguous:annotation.ambiguous||[],
    ambiguousIntervals:[...(annotation.ambiguousIntervals||[]),{start:0,end:fixture.duration,rows:Object.keys(rowClasses),
      reason:'Coverage, instrument identity and onset timing have not been independently verified.'}],
    sourceDraft:annotation.draft||null};
}

export function replayActivations(result) {
  const classifier = new PercussionClassifier(), events = [], frames = [];
  for(const frame of result.activations) {
    const emitted = classifier.push(frame.scores,frame.audioTime).events;
    events.push(...emitted.filter(e=>e.audioTime>=result.audioOrigin && e.audioTime<result.audioOrigin+result.seconds));
    const at = classifier.count-2;
    if(at<0) continue;
    const source = classifier.frames[at-classifier.base];
    frames.push({time:source.audioTime-result.audioOrigin,scores:source.scores,
      classes:classifier.thresholds.map((threshold,c)=>{
        const novelty=classifier.noveltyAt(c,at);
        const localMaximum=novelty>=classifier.noveltyAt(c,at-2) && novelty>=classifier.noveltyAt(c,at-1)
          && novelty>=classifier.noveltyAt(c,at+1);
        return {classIndex:c,activation:source.scores[c],novelty,threshold,
          thresholdPassed:novelty>=threshold,localMaximum,
          pendingBestTime:classifier.pending[c]?.best.audioTime-result.audioOrigin};
      })});
  }
  const key=e=>`${e.band}:${e.audioTime.toFixed(9)}`;
  assert.deepEqual(events.map(key).sort(),result.events.map(key).sort(),'Saved activations did not reproduce the unchanged classifier');
  return {events,frames};
}

export function locateReviewCases(reference,result,radius=.15) {
  const replay = replayActivations(result);
  return reference.observations.map(mark=>{
    const start=Math.max(0,mark.time-radius),end=Math.min(reference.end,mark.time+radius);
    const nearby=result.events.filter(e=>Math.abs(e.excerptTime-mark.time)<=radius);
    const frames=replay.frames.filter(f=>f.time>=start&&f.time<end);
    const evidence=rowClasses[mark.row].map(c=>{
      const peak=frames.map(f=>({...f.classes[c],time:f.time})).sort((a,b)=>b.novelty-a.novelty)[0];
      return peak||{classIndex:c,status:'no-activation-frame-in-navigation-window'};
    });
    return {...mark,input:reference.input,navigationWindow:{start,end,radiusMs:radius*1000,
      meaning:'review aid, not a measured uncertainty bound or matching tolerance'},
      modelEvents:nearby.map(e=>({row:bandRow(e.band),time:e.excerptTime,
        predictedOnsetToReceiptMs:(e.receivedAudioTime-e.audioTime)*1000,
        predictedOnsetToVisibleMs:Number.isFinite(e.visibleAudioTime)?(e.visibleAudioTime-e.audioTime)*1000:null})),
      learnedPeakEvidence:evidence,
      reviewReason:mark.flags.length?'Check repeated/boundary human marking before acoustic inference'
        :!nearby.some(e=>bandRow(e.band)===mark.row)?'Inspect timing/identity uncertainty, learned activation and peak selection'
        :'Inspect audible identity and actual synchronization; proximity does not verify a hit'};
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values}=parseArgs({options:{annotations:{type:'string'},benchmark:{type:'string'},output:{type:'string'}}});
  if(!values.annotations||!values.benchmark||!values.output) throw Error('Required: --annotations --benchmark --output');
  const root=resolve(values.benchmark),output=resolve(values.output);
  const scratch=resolve('scratch');
  if(!output.startsWith(scratch+'/')&&!output.startsWith(scratch+'\\')) throw Error('Private output must stay under repository scratch');
  const bytes=await readFile(values.annotations);
  const annotations=JSON.parse(bytes),manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
  const runtime=JSON.parse(await readFile(resolve(root,'candidate-a-aligned-runtime.json'),'utf8'));
  const references=[],cases=[];
  for(const annotation of annotations) {
    const fixture=manifest.excerpts.find(e=>e.input===annotation.input);
    if(!fixture) throw Error('Unknown annotation input');
    const reference=provisionalReference(annotation,fixture);
    references.push(reference);
    const result=runtime.results.find(r=>r.input.split('/').at(-1)===`whiplash-benchmark-${fixture.pcm}`);
    assert(result&&!result.eventsTruncated&&!result.activationsTruncated);
    const pcmHash=createHash('sha256').update(await readFile(resolve(root,fixture.pcm))).digest('hex');
    assert.equal(pcmHash,fixture.pcmSha256,'Private PCM no longer matches reference');
    cases.push(...locateReviewCases(reference,result));
  }
  await mkdir(output,{recursive:true});
  await writeFile(resolve(output,'provisional-references.json'),JSON.stringify(references,null,2));
  await writeFile(resolve(output,'review-cases.json'),JSON.stringify({
    sourceAnnotationSha256:createHash('sha256').update(bytes).digest('hex'),
    policy:'Investigation only. No official accuracy metrics, automatic false-positive labels or threshold tuning.',
    references:references.map(r=>({input:r.input,marks:r.observations.length,coverage:r.coverage})),cases},null,2));
  // Separate review queue: this file intentionally contains no verified notes.
  await writeFile(resolve(output,'verified-subset.pending.json'),JSON.stringify({
    referenceStatus:'awaiting-separate-verification',verified:false,entries:[],
    candidates:references.filter(r=>r.input.startsWith('W')).map(r=>({input:r.input,
      sourceSha256:r.sourceSha256,pcmSha256:r.pcmSha256,start:0,end:r.end,
      rows:{kick:null,snare:null,hat:null},coverage:'unknown',onsetUncertaintyMs:null})),
    requiredEvidence:{referenceStatus:'verified-ground-truth',purpose:'audible-onset-reference',
      origin:'human',verified:true,verification:{coverage:'complete-all-rows',
        independentOfPredictions:true,onsetUncertaintyMs:'measured/reviewed bound <=10 ms',
        method:'Document sample/waveform review independent of detector output',reviewer:'Required'},
      unresolvedAmbiguity:'Choose a smaller unambiguous interval or leave it pending; never infer missing labels from predictions.'}},null,2));
  console.log(JSON.stringify({inputs:references.length,marks:cases.length,
    flaggedMarks:cases.filter(c=>c.flags.length).length,officiallyScorable:0,output}));
}
