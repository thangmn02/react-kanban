import {expect,it} from 'vitest';
import {scoreAnnotations,temporalMatch} from '../../scripts/score-percussion-annotations.mjs';
it('matches each independently annotated attack at most once and keeps semantic rows separate',()=>{
  expect(temporalMatch([1,1.1],[1.02,1.03,1.11])).toMatchObject({tp:2,fp:1,fn:0,recall:1,precision:2/3});
  const result=scoreAnnotations([{input:'excerpt',origin:'human',verified:true,start:0,end:2,rows:{kick:[1],snare:[],hat:[]}}],
    [{input:'excerpt',duration:2,events:[{type:'snare',time:1}]}]);
  expect(result[0].rows.kick).toMatchObject({tp:0,fn:1,recall:0});
  expect(result[0].rows.snare).toMatchObject({fp:1,falseEventsPerAbsentMinute:30});
});
it('does not manufacture accuracy metrics from model references, missing labels or incomplete annotation',()=>{
  expect(scoreAnnotations([{input:'excerpt',origin:'model',verified:true}],[])[0]).toEqual({input:'excerpt',status:'awaiting-independent-annotation'});
  expect(()=>scoreAnnotations([{input:'excerpt',origin:'human',verified:true,start:0,end:2,rows:{kick:[]}}],[{input:'excerpt',duration:2,events:[]}])).toThrow();
});
