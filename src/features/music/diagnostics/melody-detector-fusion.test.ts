import { expect, it } from 'vitest';
import { compareMelodyDetectors, type DemoFixture } from './melody-detector-fusion';

const input: DemoFixture={ id:'same-audio',label:'fixture',audioSha256:'sha',analysisAudioSha256:'input-sha',
  originalUrl:'original.wav',inputUrl:'same.wav',rawPitchUrl:'raw.wav',inputLabel:'same input',start:0,end:4,version:'baseline',
  baseline:[{start:1,end:1.5,pitch:64,source:'melodia'}],basicPitch:[],frames:[],provenance:{} };
it('preserves baseline values independently and adds only distinct monophonic gap notes',()=>{
  const before=JSON.stringify(input.baseline);
  const result=compareMelodyDetectors({...input,basicPitch:[{start:.2,end:1.2,pitch:60,amp:.9},
    {start:1.01,end:1.4,pitch:64,amp:.9},{start:1.2,end:1.8,pitch:70,amp:.95},{start:2,end:3,pitch:67,amp:.9}]});
  expect(JSON.stringify(input.baseline)).toBe(before);expect(result.baseline).toEqual(input.baseline);
  expect(result.added.map(n=>n.start)).toEqual([.2,2]);expect(result.added[0].end).toBe(1);
  expect(result.fusion.every((n,i)=>i===0||n.start>=result.fusion[i-1].end)).toBe(true);
  expect(result.added.every(n=>n.experimental&&n.verified===false&&n.detector)).toBe(true);
});
it('deduplicates pitches without converting every polyphonic proposal into a flash',()=>{
  const r=compareMelodyDetectors({...input,basicPitch:[{start:.2,end:.5,pitch:60,amp:.8},{start:.21,end:.5,pitch:60,amp:.75},
    {start:2,end:2.5,pitch:65,amp:.8},{start:2.02,end:2.5,pitch:72,amp:.78}]});
  expect(r.basicPitch).toHaveLength(1);expect(r.added).toHaveLength(1);
  expect(r.decisions.some(d=>d.reason==='duplicate')).toBe(true);
  expect(r.decisions.filter(d=>d.reason==='uncertain-pitch-cluster')).toHaveLength(2);
});
it('vetoes available F0 disagreement and abstains on weak unsupported proposals',()=>{
  const r=compareMelodyDetectors({...input,basicPitch:[{start:.2,end:.5,pitch:72,amp:.9},{start:2,end:2.5,pitch:67,amp:.55}],
    frames:Array.from({length:8},(_,i)=>({time:.2+i*.01,hz:261.626,voiced:true}))});
  expect(r.added).toEqual([]);
  expect(r.decisions.map(d=>d.reason)).toContain('available-f0-disagrees');
  expect(r.decisions.map(d=>d.reason)).toContain('no-f0-support-and-uncertain-bp');
});
