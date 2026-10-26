import {expect,it,vi} from 'vitest';
import {createDelayedAudioOutput} from './delayed-audio-output.js';

function graph() {
  const connections=new Map(),gains=[],delays=[],operations=[];
  const node=label=>({label,connect:vi.fn(target=>{operations.push(['connect',label,target.label]);(connections.get(label)||connections.set(label,new Set()).get(label)).add(target.label);}),
    disconnect:vi.fn(target=>{operations.push(['disconnect',label,target?.label]);if(target)connections.get(label)?.delete(target.label);else connections.delete(label);})});
  const source=node('source'),destination=node('destination');
  const context={currentTime:2,destination,createGain(){const gain=Object.assign(node('gain'+gains.length),{gain:{value:1,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn()}});gains.push(gain);return gain;},
    createDelay(){const delay=Object.assign(node('delay'+delays.length),{delayTime:{value:0}});delays.push(delay);return delay;}};
  const output=createDelayedAudioOutput(context,source);return {source,context,output,connections,gains,delays,operations};
}
it('disconnects a full old delay before connecting its successor and leaves analysis connected',()=>{
  const f=graph();f.source.connect({label:'analysis'});f.output.replace(170);
  const before=f.operations.length;f.output.replace(200);
  expect(f.gains[0].gain.value).toBe(0);expect(f.gains[0].gain.cancelScheduledValues).toHaveBeenCalledWith(2);
  expect(f.delays[0].disconnect).toHaveBeenCalledOnce();
  expect(f.connections.get('source')).toEqual(new Set(['analysis','delay1']));
  expect(f.operations.slice(before).findIndex(x=>x[0]==='disconnect')).toBeLessThan(f.operations.slice(before).findIndex(x=>x[0]==='connect'));
  expect(f.delays[1].delayTime.value).toBe(.2);f.output.stop();
  expect(f.connections.get('source')).toEqual(new Set(['analysis']));
});
it('bounds rapid replacements, restores OFF and releases every owned node idempotently',()=>{
  const f=graph();for(let i=0;i<50;i++)f.output.replace(i%2?0:170);
  expect(f.connections.get('source')).toEqual(new Set(['gain49']));expect(f.delays).toHaveLength(25);
  f.output.stop();f.output.stop();expect(f.connections.get('source').size).toBe(0);
  expect(f.gains.every(gain=>gain.disconnect.mock.calls.length===1)).toBe(true);
});
it.each([-1,501,NaN,Infinity,'170'])('rejects invalid delay %s without destroying the working route',value=>{
  const f=graph();f.output.replace(170);expect(()=>f.output.replace(value)).toThrow(RangeError);
  expect(f.gains[0].disconnect).not.toHaveBeenCalled();f.output.stop();
});
