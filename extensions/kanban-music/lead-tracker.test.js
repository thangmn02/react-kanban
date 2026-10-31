import {it,expect,vi} from 'vitest';
import {createLeadTracker,LEAD_TRACKER_VERSION} from './lead-tracker.js';
import {createLeadRuntime} from './lead-runtime.js';

const rate=44100;
const silence=seconds=>new Float32Array(Math.round(seconds*rate));
// Six-partial tone with a 10 ms attack, like a plucked or sung note.
const tone=(target,hz,start,seconds,amp=.3)=>{for(let i=0;i<seconds*rate;i++){const t=i/rate;let s=0;for(let h=1;h<=6;h++)s+=Math.sin(2*Math.PI*hz*h*t)/h;target[Math.round(start*rate)+i]+=amp*s*Math.min(1,t/.01);}return target;};
// Stream in render quanta exactly as the AudioWorklet does; no look-ahead.
const run=(samples,options)=>{const tracker=createLeadTracker(rate,options),events=[];
  for(let i=0;i<samples.length;i+=128)events.push(...tracker.push(samples.subarray(i,i+128),Math.min(samples.length,i+128)/rate));return events;};

it('announces one attack per note and never retriggers a sustained note',()=>{
  expect(run(tone(silence(4),330,.5,3))).toHaveLength(1);
  const tremolo=tone(silence(4),330,.5,3);for(let i=0;i<tremolo.length;i++)tremolo[i]*=1+.15*Math.sin(2*Math.PI*5.5*i/rate);
  expect(run(tremolo)).toHaveLength(1);
});
it('separates repeated same-pitch notes and legato pitch changes',()=>{
  const repeated=silence(4);for(let k=0;k<6;k++)tone(repeated,330,.5+k*.5,.25);
  const events=run(repeated);
  expect(events).toHaveLength(6);
  events.forEach((event,k)=>{expect(Math.abs(event.audioTime-(.5+k*.5))).toBeLessThan(.03);expect(event.midiPitch).toBe(64);});
  const scale=silence(4);[262,294,330,349,392,440].forEach((hz,k)=>tone(scale,hz,.5+k*.5,.45));
  expect(run(scale).map(event=>event.midiPitch)).toEqual([60,62,64,65,67,69]);
});
it('abstains on silence and unpitched noise',()=>{
  expect(run(silence(3))).toEqual([]);
  let seed=7;const noise=Float32Array.from({length:3*rate},()=>((seed=seed*16807%2147483647)/2147483647*2-1)*.2);
  expect(run(noise).length).toBeLessThanOrEqual(1);
});
it('reports the attack time, not the decision time, and is causal',()=>{
  const samples=tone(silence(2),220,1,.6),tracker=createLeadTracker(rate);const seen=[];
  for(let i=0;i<samples.length;i+=128){const end=Math.min(samples.length,i+128)/rate;for(const event of tracker.push(samples.subarray(i,i+128),end))seen.push({...event,end});}
  expect(seen).toHaveLength(1);
  expect(Math.abs(seen[0].audioTime-1)).toBeLessThan(.03);
  // Decided only from audio already pushed, about one window plus confirmation after the attack.
  expect(seen[0].end-seen[0].audioTime).toBeGreaterThan(.04);expect(seen[0].end-seen[0].audioTime).toBeLessThan(.12);
  expect(['start','change','repeat']).toContain(seen[0].kind);expect(seen[0].confidence).toBeGreaterThan(0);expect(seen[0].confidence).toBeLessThanOrEqual(1);
});
it('forgets the followed note on reset',()=>{
  const tracker=createLeadTracker(rate),samples=tone(silence(1.5),330,.2,1.2);
  let count=0;for(let i=0;i<samples.length;i+=128){if(i===Math.round(.8*rate/128)*128)tracker.reset();count+=tracker.push(samples.subarray(i,i+128),Math.min(samples.length,i+128)/rate).length;}
  expect(count).toBe(2);
});
it('accepts only events from the current capture owner and stops cleanly',async()=>{
  const port={postMessage:vi.fn(),close:vi.fn(),onmessage:null};
  const node={port,connect:vi.fn(),disconnect:vi.fn()};
  const gain={gain:{value:1},connect:vi.fn(),disconnect:vi.fn()};
  const context={audioWorklet:{addModule:vi.fn(async()=>{})},createGain:()=>gain,destination:{},currentTime:2};
  const source={connect:vi.fn(),disconnect:vi.fn()};
  const events=[];
  const runtime=await createLeadRuntime({context,source,ownership:{captureId:'c',epoch:'e1'},onEvent:e=>events.push(e),Node:function(){return node;}});
  expect(gain.gain.value).toBe(0);
  const deliver=(ownership,list)=>port.onmessage({data:{kind:'events',ownership,version:LEAD_TRACKER_VERSION,events:list}});
  deliver({captureId:'c',epoch:'e1'},[{audioTime:1.5,decidedAt:1.58,kind:'start',confidence:.7,midiPitch:64},{audioTime:NaN,kind:'start',confidence:.5}]);
  deliver({captureId:'old',epoch:'e1'},[{audioTime:1.6,kind:'start',confidence:.5}]);
  runtime.reset({captureId:'c',epoch:'e2'});
  deliver({captureId:'c',epoch:'e1'},[{audioTime:1.7,kind:'change',confidence:.5}]);
  deliver({captureId:'c',epoch:'e2'},[{audioTime:1.8,kind:'repeat',confidence:.6}]);
  expect(events.map(e=>e.audioTime)).toEqual([1.5,1.8]);
  expect(events[0]).toMatchObject({midiPitch:64,receivedAudioTime:2,version:LEAD_TRACKER_VERSION});
  expect(runtime.health).toMatchObject({ready:true,events:2,dropped:2});
  const late=port.onmessage;runtime.stop();
  expect(port.onmessage).toBeNull();
  expect(port.postMessage).toHaveBeenLastCalledWith({kind:'stop'});expect(source.disconnect).toHaveBeenCalledWith(node);
  // A message already in flight when capture stopped is ignored.
  late({data:{kind:'events',ownership:{captureId:'c',epoch:'e2'},events:[{audioTime:2,kind:'start',confidence:.5}]}});
  expect(events).toHaveLength(2);expect(runtime.health.ready).toBe(false);
});
it('stays unavailable when the browser cannot run an AudioWorklet',async()=>{
  expect(await createLeadRuntime({context:{},source:{},ownership:{},onEvent(){}})).toBeNull();
});
