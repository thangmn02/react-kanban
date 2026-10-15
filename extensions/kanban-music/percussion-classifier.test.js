import { expect, it } from 'vitest';
import { PercussionClassifier } from './percussion-classifier.js';
function sequence(attacks, length = 100) {
  const classifier = new PercussionClassifier(), events = [];
  for (let frame = 0; frame < length; frame++) {
    const scores = Array(5).fill(.001);
    for (const [at, instrument] of attacks) if (frame === at) scores[instrument] = .9;
    events.push(...classifier.push(scores, frame / 100).events);
  }
  return events;
}
it('abstains on silence, low scores and sustained activations instead of inventing percussion', () => {
  const classifier = new PercussionClassifier();
  for (let i = 0; i < 1000; i++) expect(classifier.push(Array(5).fill(i < 500 ? 0 : .1), i / 100).events).toEqual([]);
  const sustained = new PercussionClassifier();
  for (let i = 0; i < 50; i++) expect(sustained.push(Array(5).fill(.95), i / 100).events).toEqual([]);
  expect(classifier.frames.length).toBeLessThanOrEqual(16);
});
it('keeps learned classes independent and never maps tom to a semantic row', () => {
  const events = sequence([[20, 0], [20, 1], [20, 2], [20, 3], [20, 4], [50, 1]]);
  expect(events.map(e => [e.audioTime, e.band])).toEqual([[.2, 'kick'], [.2, 'clap'], [.2, 'hat'], [.5, 'clap']]);
  for (const e of events) { expect(e.confidence).toBe(.9); expect(e.classMargin).toBeGreaterThan(0); }
});
it('rejects malformed/non-model evidence and flushes pending attacks on clock discontinuity', () => {
  const classifier = new PercussionClassifier();
  for (const scores of [[.9], [NaN, 0, 0, 0, 0], [2, 0, 0, 0, 0], { kick: .9 }])
    expect(classifier.push(scores, 0)).toEqual({ outcome: 'abstain', events: [] });
  for (let frame = 0; frame <= 20; frame++) classifier.push([frame === 20 ? .9 : 0, 0, 0, 0, 0], frame / 100);
  for (let frame = 0; frame < 20; frame++) expect(classifier.push([0, 0, 0, 0, 0], 10 + frame / 100).events).toEqual([]);
});
it('preserves distinct 20 ms activation rises with one bounded onset-guided refinement',()=>{
  const run=onsetGuided=>{
    const classifier=new PercussionClassifier(undefined,{onsetGuided}),events=[];
    for(let frame=0;frame<60;frame++)events.push(...classifier.push([0,[20,22].includes(frame)?.9:0,0,0,0],frame/100).events);
    return events.map(e=>e.audioTime);
  };
  expect(run(false)).toEqual([.2]);
  expect(run(true)).toEqual([.2,.22]);
});
it('does not turn wide or sustained activation peaks into multiple attacks in the refinement',()=>{
  const classifier=new PercussionClassifier(undefined,{onsetGuided:true}),events=[];
  for(let frame=0;frame<100;frame++)events.push(...classifier.push([0,frame>=20&&frame<=24?.9:0,0,0,0],frame/100).events);
  expect(events).toHaveLength(1);
});
it('explains rejected peaks and grouping without changing emitted events',()=>{
  const plain=new PercussionClassifier(undefined,{onsetGuided:true}),traced=new PercussionClassifier(undefined,{onsetGuided:true,diagnostics:true});
  const decisions=[];
  for(let frame=0;frame<100;frame++){
    const scores=[0,frame>=20&&frame<=24?.9:0,0,0,0];
    const a=plain.push(scores,frame/100),b=traced.push(scores,frame/100);
    expect(a.events).toEqual(b.events);decisions.push(...(b.decisions||[]));
  }
  expect(decisions.some(d=>d.action==='below-threshold')).toBe(true);
  expect(decisions.some(d=>d.emitted.length>0)).toBe(true);
});
it('limits the private local-prominence option to Snare and Hat without splitting plateaus',()=>{
  const a=new PercussionClassifier(undefined,{onsetGuided:true});
  const b=new PercussionClassifier(undefined,{onsetGuided:true,localProminence:true});
  const eventsA=[],eventsB=[];
  for(let frame=0;frame<150;frame++){
    const score=frame>=20&&frame<=24?.9:0;
    const scores=[score,score,score,score,score];
    eventsA.push(...a.push(scores,frame/100).events);eventsB.push(...b.push(scores,frame/100).events);
  }
  expect(eventsB.filter(e=>e.band==='kick')).toEqual(eventsA.filter(e=>e.band==='kick'));
  for(const band of ['kick','clap','hat'])expect(eventsB.filter(e=>e.band===band)).toHaveLength(1);
});
