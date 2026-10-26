import {expect,it} from 'vitest';
import {PercussionClassifier} from './percussion-classifier.js';
import {EarlyPercussionClassifier} from './early-percussion-classifier.js';
import {mapPercussionCandidates,validateHatLabelMode} from './percussion-label-contract.js';
const thresholds=[.22,.24,.32,.22,.30];
function replay(Classifier,labelMapping,attacks){
  const classifier=new Classifier(undefined,{onsetGuided:true,diagnostics:true,labelMapping}),events=[],audit=[];
  for(let frame=0;frame<80;frame++){
    const scores=Array(5).fill(0);for(const [at,head,score] of attacks)if(frame===at)scores[head]=score;
    const result=classifier.push(scores,frame/100);events.push(...result.events);audit.push(...result.labelCandidates||[]);
  }
  return {events,audit};
}
it('defaults to the unchanged mapping and rejects an unknown research mode',()=>{
  expect(validateHatLabelMode()).toBe('off');expect(()=>validateHatLabelMode('enabled')).toThrow();
});
for(const Classifier of [PercussionClassifier,EarlyPercussionClassifier]){
  it(`${Classifier.name} retains rapid Hat and simultaneous Kick/Snare timestamps with guards OFF`,()=>{
    const attacks=[20,24,28].flatMap(time=>[[time,0,.9],[time,1,.9],[time,3,.9]]);
    const baseline=replay(Classifier,'M0',attacks),strict=replay(Classifier,'M1',attacks);
    expect(strict.events).toEqual(baseline.events);expect(strict.events.filter(e=>e.band==='hat').map(e=>e.audioTime)).toEqual([.2,.24,.28]);
    expect(new Set(strict.events.map(e=>e.band))).toEqual(new Set(['kick','clap','hat']));
  });
  it(`${Classifier.name} suppresses Cymbal only and preserves both same-timestamp head candidates`,()=>{
    const attacks=[[20,0,.9],[20,1,.9],[20,3,.85],[20,4,.99]];
    const baseline=replay(Classifier,'M0',attacks),strict=replay(Classifier,'M1',attacks);
    expect(baseline.events.find(e=>e.band==='hat').classIndex).toBe(4);
    expect(strict.events.find(e=>e.band==='hat')).toMatchObject({classIndex:3,audioTime:.2,confidence:.85});
    expect(strict.events.filter(e=>e.band!=='hat')).toEqual(baseline.events.filter(e=>e.band!=='hat'));
    expect(baseline.audit.filter(e=>e.mappedSemanticKind==='hat').map(e=>e.originalClassIndex).sort()).toEqual([3,4]);
    expect(strict.audit.find(e=>e.originalClassIndex===4)).toMatchObject({originalClassName:'cymbal',mappedSemanticKind:null,finalEmissionDecision:'suppressed-label-contract'});
  });
  it(`${Classifier.name} exposes loss when a genuine subtype is represented only by model head4`,()=>{
    // A model-output contract test; it does not label any real audio as Open Hat.
    const baseline=replay(Classifier,'M0',[[20,4,.99]]),strict=replay(Classifier,'M1',[[20,4,.99]]);
    expect(baseline.events).toHaveLength(1);expect(strict.events).toHaveLength(0);
    expect(strict.audit[0].rawClassScore).toBe(.99);
  });
}
it('preserves exact-time tie order and never rewrites scores or timestamps',()=>{
  const events=[3,4].map(classIndex=>({classIndex,band:'hat',audioTime:1,confidence:.9,value:.8,scores:[0,0,0,.9,.9]}));
  const before=JSON.stringify(events),mapped=mapPercussionCandidates(events,'M0',thresholds,true);
  expect(mapped.events).toEqual([events[0]]);expect(mapped.labelCandidates[1].finalEmissionDecision).toBe('same-timestamp-suppressed');
  expect(JSON.stringify(events)).toBe(before);
});
it('resets pending groups on a source-time discontinuity',()=>{
  const classifier=new PercussionClassifier(undefined,{onsetGuided:true,labelMapping:'M1',diagnostics:true});
  for(let i=0;i<23;i++)classifier.push([0,0,0,i===20?.9:0,0],i/100);
  const events=[];for(let i=0;i<20;i++)events.push(...classifier.push([0,0,0,0,0],10+i/100).events);
  expect(events).toHaveLength(0);
});
