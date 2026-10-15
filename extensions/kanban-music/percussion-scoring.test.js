import {expect,it} from 'vitest';
import {scoreAnnotations,temporalMatch} from '../../scripts/score-percussion-annotations.mjs';
const identity={sourceSha256:'a'.repeat(64),pcmSha256:'b'.repeat(64)};
const reference=()=>({input:'excerpt',origin:'human',verified:true,purpose:'audible-onset-reference',
  referenceStatus:'verified-ground-truth',start:0,end:2,...identity,
  verification:{coverage:'complete-all-rows',independentOfPredictions:true,onsetUncertaintyMs:10,
    reviewer:'Independent reviewer',method:'Sample-level waveform and listening review'},
  rows:{kick:[1],snare:[],hat:[]}});
it('matches each independently annotated attack at most once and keeps semantic rows separate',()=>{
  expect(temporalMatch([1,1.1],[1.02,1.03,1.11])).toMatchObject({tp:2,fp:1,fn:0,recall:1,precision:2/3});
  const result=scoreAnnotations([reference()],
    [{input:'excerpt',duration:2,...identity,events:[{type:'snare',time:1}]}]);
  expect(result[0].rows.kick).toMatchObject({tp:0,fn:1,recall:0});
  expect(result[0].rows.snare).toMatchObject({fp:1,falseEventsPerAbsentMinute:30});
});
it('does not manufacture accuracy metrics from model references, missing labels or incomplete annotation',()=>{
  expect(scoreAnnotations([{...reference(),origin:'model'}],[])[0]).toEqual({input:'excerpt',status:'awaiting-independent-annotation'});
  expect(()=>scoreAnnotations([{...reference(),rows:{kick:[]}}],[{input:'excerpt',duration:2,...identity,events:[]}])).toThrow(/Complete unique typed annotations/);
});
