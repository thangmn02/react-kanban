import test from 'node:test';
import assert from 'node:assert/strict';
import {blankReview,validateReview,validateReviewTransition,retainReferenceExposure,freezeBlockers,matchOnsets,compareReview,describeCandidate,classifyTrace} from './acoustic-visual-lab-core.ts';
const clip={id:'test',start:45,end:57,originalSourceSha256:'original',canonicalWavSha256:'wav',predictions:{A:[],B:[],C:[]},raw:{A:null,B:null,C:null}};
const mark=(time,id)=>({id,sourceTime:time,instrument:'hat',audibility:'high',overlap:false,ambiguous:false,uncertaintyMs:1,verified:true,reviewer:'human',origin:'blind-waveform-review',modelVisibleWhenMarked:false,notes:'',failures:[]});
test('provisional labels never produce official metrics or manufactured misses',()=>{
 const d=blankReview(clip);d.events=[mark(46,'one')];assert.deepEqual(compareReview(d,clip).metrics,{});assert.equal(compareReview(d,clip).rows[0].candidates.A.primaryCause,'UNKNOWN');
});
test('references and predictions use strict gap/4 one-to-one matching',()=>{
 assert.equal(matchOnsets([1,1.02],[1.004,1.016]).length,2);
 assert.equal(matchOnsets([1,1.02],[1.01]).length,0);
 assert.equal(matchOnsets([1],[1,1.001]).length,1);
 assert.equal(matchOnsets([1,1.03],[1.008,1.022]).length,0);
});
test('source mismatch, duplicate identities and invented verification are rejected',()=>{
 const d=blankReview(clip);d.events=[mark(46,'one')];
 assert.throws(()=>validateReview({...d,sourceSha256:'other'},clip));
 assert.throws(()=>validateReview({...d,events:[...d.events,...d.events]},clip));
 assert.throws(()=>validateReview({...d,frozen:true,referenceStatus:'human-reviewed-subset'},clip));
});
test('freeze requires blind review, complete coverage and sufficiently exact onsets',()=>{
 const d=blankReview(clip);d.complete={kick:true,snare:true,hat:true};d.events=[mark(46,'one'),mark(46.02,'two')];
 assert.equal(freezeBlockers(d).length,0);d.events[0].uncertaintyMs=6;assert(freezeBlockers(d).length);
 d.events[0].uncertaintyMs=1;d.events[0].modelVisibleWhenMarked=true;assert(freezeBlockers(d).length);
});
test('ambiguous intervals and their boundary guard are excluded without false positive claims',()=>{
 const d=blankReview(clip);d.complete={kick:true,snare:true,hat:true};d.events=[mark(46,'one')];d.ambiguousIntervals=[{start:47,end:48,reason:'overlap'}];
 d.frozen=true;d.referenceStatus='human-reviewed-subset';
 const c={...clip,predictions:{A:[{sourceTime:46,instrument:'hat'},{sourceTime:47.01,instrument:'hat'}],B:[],C:[]}};
 const result=compareReview(validateReview(d,clip),c);assert.equal(result.metrics['A:hat'].tp,1);assert.equal(result.metrics['A:hat'].fp,0);assert.equal(result.metrics['C:hat'].status,'COARSE_GROUP_NOT_TRUE_HAT');
});
test('bounded live log omissions stay unknown, explicit loss has a single primary stage',()=>{
 assert.equal(classifyTrace([{id:'x',stage:'EVENT_SENT'}],'x'),'UNKNOWN');
 assert.equal(classifyTrace([{id:'x',stage:'EVENT_DROPPED',reason:'debounce'}],'x'),'CONTROLLER_SUPPRESSION');
 assert.equal(classifyTrace([{id:'x',stage:'EVENT_DROPPED',reason:'transport'}],'x'),'TRANSPORT_LOSS');
 assert.equal(classifyTrace([{id:'x',stage:'EVENT_LATE'}],'x'),'SCHEDULER_LATE');
});
test('confirmed causes require actual evidence references',()=>{
 const d=blankReview(clip);d.events=[{...mark(46,'one'),failures:[{model:'A',primary:'MODEL_MISS',secondary:[],evidenceRefs:[],confirmed:true}]}];assert.throws(()=>validateReview(d,clip));
});
test('reveal then hide/reload cannot reset exposure or create independent new/edited marks',()=>{
 const prior={...blankReview(clip),modelsRevealed:true,events:[mark(46,'first')]};
 assert.throws(()=>validateReviewTransition(prior,{...prior,modelsRevealed:false}));
 assert.throws(()=>validateReviewTransition(prior,{...prior,events:[...prior.events,mark(47,'new')]}));
 assert.throws(()=>validateReviewTransition(prior,{...prior,events:[{...prior.events[0],sourceTime:46.01}]}));
 assert.doesNotThrow(()=>validateReviewTransition(prior,retainReferenceExposure(prior,{...prior,events:[{...prior.events[0],sourceTime:46.01,modelVisibleWhenMarked:true}]})));
 assert.doesNotThrow(()=>validateReviewTransition(prior,prior));
});
test('post-reveal denominator selection stays provisional, including deletion and coverage changes',()=>{
 const prior={...blankReview(clip),modelsRevealed:true,complete:{kick:true,snare:true,hat:true},events:[mark(46,'first'),mark(47,'second')]};
 for(const change of [{events:[prior.events[0]]},{start:45.5},{end:56},{complete:{kick:false,snare:true,hat:true}},{ambiguousIntervals:[{start:46.5,end:47.5,reason:'overlap'}]}]){
  assert.throws(()=>validateReviewTransition(prior,{...prior,...change}));
  const retained=retainReferenceExposure(prior,{...prior,...change});assert.equal(retained.referenceSelectionExposed,true);assert(freezeBlockers(retained).length);assert.doesNotThrow(()=>validateReviewTransition(prior,retained));
  assert.throws(()=>validateReviewTransition(retained,{...retained,referenceSelectionExposed:false}));
 }
 const notes={...prior,events:prior.events.map(e=>({...e,notes:'Causal investigation only'}))};assert.equal(retainReferenceExposure(prior,notes).referenceSelectionExposed,false);
});
test('missing separated inputs are N/A for every class, not mislabeled coarse-Hat results',()=>{
 const d={...blankReview(clip),frozen:true,referenceStatus:'human-reviewed-subset',complete:{kick:true,snare:true,hat:true},events:[mark(46,'first')]};
 const result=compareReview(d,{...clip,predictions:{...clip.predictions,C:null}});
 for(const key of ['kick','snare','hat'])assert.equal(result.metrics['C:'+key].status,'NO_SAVED_INPUT');
});
test('frozen strict misses retain navigation proposals without a fabricated matched error',()=>{
 const d={...blankReview(clip),frozen:true,referenceStatus:'human-reviewed-subset',complete:{kick:true,snare:true,hat:true},events:[mark(46,'first')]};
 const result=compareReview(d,{...clip,predictions:{...clip.predictions,A:[{id:'p',sourceTime:46.08,instrument:'hat'}]}});
 assert.equal(result.rows[0].candidates.A.proposals.length,1);
 assert.equal(result.rows[0].candidates.A.outcome,'MISSED_REVIEWED_HIT');
 assert.equal(result.rows[0].candidates.A.matchedPrediction,null);
 assert.equal(result.rows[0].candidates.A.timeErrorMs,null);
 assert.equal(describeCandidate(result.rows[0].candidates.A,true),'No strict matched prediction.');
});
test('a reviewed reference cannot score a model window with unavailable raw-frame coverage',()=>{
 const d={...blankReview(clip),frozen:true,referenceStatus:'human-reviewed-subset',complete:{kick:true,snare:true,hat:true},events:[mark(46,'first')]};
 const result=compareReview(d,{...clip,coverage:{A:{uncoveredIntervals:[{start:56.9,end:57,reason:'EOF context'}],completeRawCoverage:false}}});
 assert.equal(result.metrics['A:hat'].status,'UNAVAILABLE_ANALYSIS_GAP');assert.equal(result.rows[0].candidates.A.outcome,'UNAVAILABLE_ANALYSIS_GAP');assert.equal(result.metrics['B:hat'].fn,1);
});
