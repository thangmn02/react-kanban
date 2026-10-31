import {it,expect} from 'vitest';
import {createLeadContourTracker} from './lead-contour-tracker.js';

const rate=44100,silence=s=>new Float32Array(Math.round(s*rate));
const tone=(target,hz,start,seconds,amp=.3)=>{for(let i=0;i<seconds*rate;i++){const t=i/rate;let s=0;for(let h=1;h<=6;h++)s+=Math.sin(2*Math.PI*hz*h*t)/h;target[Math.round(start*rate)+i]+=amp*s*Math.min(1,t/.01);}return target;};
const run=samples=>{const tracker=createLeadContourTracker(rate),events=[];for(let i=0;i<samples.length;i+=128)events.push(...tracker.push(samples.subarray(i,i+128),Math.min(samples.length,i+128)/rate));return {events,tracker};};

it('follows one line: one attack per note, none for sustain or silence',()=>{
  expect(run(tone(silence(4),330,.5,3)).events).toHaveLength(1);
  expect(run(silence(3)).events).toEqual([]);
  const scale=silence(4);[262,294,330,349,392,440].forEach((hz,k)=>tone(scale,hz,.5+k*.5,.45));
  expect(run(scale).events.map(e=>e.midiPitch)).toEqual([60,62,64,65,67,69]);
});
it('keeps the owner through a brief louder note elsewhere and never emits attacks that predate ownership',()=>{
  const x=silence(5);for(let k=0;k<8;k++)tone(x,440,.5+k*.5,.4);tone(x,110,2.05,.15,.6);
  const {events,tracker}=run(x);
  expect(tracker.stats.switches).toBe(0);
  expect(events.every(e=>Math.abs(e.midiPitch-69)<1)).toBe(true);
  expect(events.every(e=>e.decidedAt-e.audioTime<.15)).toBe(true);
});
it('labels the source only as vocal or unknown, never a guessed instrument',()=>{
  const {events}=run(tone(silence(3),330,.5,2));
  for(const e of events){expect(['vocal','unknown']).toContain(e.source);expect(e.contourConfidence).toBeGreaterThanOrEqual(0);}
});
