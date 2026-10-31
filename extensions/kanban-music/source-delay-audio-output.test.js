import {expect,it,vi} from 'vitest';
import {createSmoothAudioOutput} from './source-delay-audio-output.js';

function graph(state='running') {
  const connections=new Map(),gains=[],delays=[],timers=[];
  const node=label=>({label,connect:vi.fn(target=>{(connections.get(label)||connections.set(label,new Set()).get(label)).add(target.label);}),
    disconnect:vi.fn(target=>{if(target)connections.get(label)?.delete(target.label);else connections.delete(label);})});
  const param=()=>{const events=[];return {value:0,events,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn((value,at)=>events.push(['set',value,at])),
    linearRampToValueAtTime:vi.fn((value,at)=>events.push(['ramp',value,at]))};};
  const source=node('source'),destination=node('destination');
  const context={currentTime:2,state,destination,createGain(){const gain=Object.assign(node('gain'+gains.length),{gain:param()});gains.push(gain);return gain;},
    createDelay(){const delay=Object.assign(node('delay'+delays.length),{delayTime:{value:0}});delays.push(delay);return delay;}};
  const output=createSmoothAudioOutput(context,source,{fade:.01,schedule:(run,ms)=>timers.push({run,ms})});
  const audible=gain=>{gain.gain.value=1;};
  return {source,context,output,connections,gains,delays,timers,audible,flush:()=>timers.splice(0).forEach(timer=>timer.run())};
}

it('fades a playing delayed route out before the undelayed successor fades in, so they never overlap',()=>{
  const f=graph();f.output.replace(170);f.audible(f.gains[0]);f.output.replace(0);
  expect(f.gains[0].gain.events.slice(-2)).toEqual([['set',1,2],['ramp',0,2.01]]);
  expect(f.gains[1].gain.events).toEqual([['set',0,2.01],['ramp',1,expect.closeTo(2.02,9)]]);
  expect(f.connections.get('source')).toEqual(new Set(['delay0','gain1']));
  expect(f.output.snapshot().retiring).toBe(1);
  f.flush();expect(f.connections.get('source')).toEqual(new Set(['gain1']));expect(f.output.snapshot().retiring).toBe(0);
});
it('starts a delayed successor immediately because its empty delay line is silent until refilled',()=>{
  const f=graph();f.output.replace(0);f.audible(f.gains[0]);f.output.replace(170);
  expect(f.gains[1].gain.events).toEqual([['set',0,2],['ramp',1,2.01]]);expect(f.delays[0].delayTime.value).toBe(.17);
});
it('releases muted, suspended and never-audible routes immediately',()=>{
  for(const state of ['running','suspended']){
    const f=graph(state);f.output.replace(170,{muted:true});f.output.replace(0);
    expect(f.timers).toHaveLength(0);expect(f.gains[0].disconnect).toHaveBeenCalledOnce();
  }
});
it('stop fades, resolves after release and tears every node down exactly once',async()=>{
  const f=graph();f.source.connect({label:'analysis'});f.output.replace(170);f.audible(f.gains[0]);
  let released=false;const stopped=f.output.stop().then(()=>{released=true;});f.output.stop();
  await Promise.resolve();expect(released).toBe(false);expect(f.timers[0].ms).toBe(35);
  f.flush();f.flush();await stopped;expect(released).toBe(true);
  expect(f.gains[0].disconnect).toHaveBeenCalledOnce();expect(f.delays[0].disconnect).toHaveBeenCalledOnce();
  expect(f.connections.get('source')).toEqual(new Set(['analysis']));
});
it('bounds rapid ON/OFF; retired branches all release once and only the newest stays connected',()=>{
  const f=graph();for(let i=0;i<50;i++){f.output.replace(i%2?0:170);f.audible(f.gains[i]);}
  f.flush();expect(f.connections.get('source')).toEqual(new Set(['gain49']));
  expect(f.gains.slice(0,49).every(gain=>gain.disconnect.mock.calls.length===1)).toBe(true);
});
it.each([-1,501,NaN,Infinity,'170'])('rejects invalid delay %s without touching the working route',value=>{
  const f=graph();f.output.replace(170);expect(()=>f.output.replace(value)).toThrow(RangeError);
  expect(f.output.snapshot()).toMatchObject({connected:true,configuredDelayMs:170});
});
