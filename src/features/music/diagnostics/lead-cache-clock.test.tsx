import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createLeadCacheClock } from './lead-cache-clock';
import SemanticBeatPattern from '../SemanticBeatPattern';
import BeatPattern from '../BeatPattern';
import type { DemoFixture } from './melody-detector-fusion';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';
vi.mock('../../native/runtime',()=>({isNativeWidget:()=>false}));
vi.mock('../../../lib/supabase',()=>({default:null}));
const fixture:DemoFixture={id:'lead-test',label:'test',audioSha256:'original',analysisAudioSha256:'stem',
  originalUrl:'',inputUrl:'',rawPitchUrl:'',inputLabel:'automatic',start:0,end:30,version:'lead-pulse-v1',
  baseline:[],basicPitch:[],frames:[],provenance:{},asset:{provider:'soundcloud',id:'private-local/test'},
  lead:[{start:.3,end:.38,pitch:null,source:'vocals',confidence:.6,policyVersion:'lead-pulse-v1',kind:'vocal-articulation',detector:'vocal-body-articulation',inputSha256:'a'.repeat(64)},
    {start:1,end:1.2,pitch:64,source:'piano',confidence:.6,policyVersion:'lead-pulse-v1',kind:'pitched-note',detector:'melodia',inputSha256:'a'.repeat(64)}],
  sections:[{start:0,end:.8,source:'vocals'},{start:.8,end:30,source:'piano'}]};
let audio:HTMLAudioElement,driver:ReturnType<typeof createLeadCacheClock>;
function media(paused:boolean,time=audio.currentTime,name=paused?'pause':'playing') {
  Object.defineProperty(audio,'paused',{configurable:true,value:paused});audio.currentTime=time;audio.dispatchEvent(new Event(name));
}
async function advance(ms:number){for(let i=0;i<ms;i+=10){if(!audio.paused)audio.currentTime+=.01*audio.playbackRate;await vi.advanceTimersByTimeAsync(10);}}
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(10000);beatTelemetry.enable();beatTelemetry.clear();audio=document.createElement('audio');
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});media(true,0);
  vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Live analysis service must not be used'));
});
afterEach(()=>{driver?.dispose();cleanup();beatTelemetry.enable(false);vi.restoreAllMocks();vi.useRealTimers();});
it('uses the real product scheduler and renderer for unpitched Lead without affecting other rows',async()=>{
  driver=createLeadCacheClock(audio,fixture,()=>{});
  media(false);await advance(100);
  const first=driver.snapshot();const view=render(<SemanticBeatPattern key={first.generation} session={first.session} beat={first.beat}/>);
  await act(async()=>advance(250));const state=driver.snapshot();
  view.rerender(<SemanticBeatPattern key={state.generation} session={state.session} beat={state.beat}/>);
  await act(async()=>vi.advanceTimersByTimeAsync(1));
  expect(state.latest).toBe(.3);expect(state.beat.onsets).toEqual({melody:1});expect(state.currentPitch).toBeNull();
  const trace=state.beat.telemetry!['onset:melodic'];expect(driver.detail(trace.eventId!)).toMatchObject({midiPitch:null,selectedSource:'vocals',onset:.3});
  expect(view.container.querySelector('[data-beat-trace]')).toHaveAttribute('data-beat-row','5');
  expect(beatTelemetry.snapshot().records.some(r=>r.stage==='LEAD_EVENT')).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it('supplies identical unpitched cached events to the retained private renderer preview',async()=>{
  driver=createLeadCacheClock(audio,fixture,()=>{});media(false);await advance(100);
  const before=driver.snapshot();const view=render(<BeatPattern melodyEnabled session={before.session} beat={before.beat} semanticOnly={false}/>);
  await act(async()=>advance(250));const state=driver.snapshot();
  view.rerender(<BeatPattern melodyEnabled session={state.session} beat={state.beat} semanticOnly={false}/>);
  await act(async()=>vi.advanceTimersByTimeAsync(1));
  expect(state.beat.leadAvailability).toBe('ready');expect(state.beat.melody).toMatchObject({active:true,note:1});
  const flashed=[...view.container.querySelectorAll('[data-beat-trace]')];
  expect(flashed.length).toBeGreaterThan(0);expect(flashed.every(cell=>cell.getAttribute('data-beat-row')==='5')).toBe(true);
  media(true);const paused=driver.snapshot();view.rerender(<BeatPattern melodyEnabled session={paused.session} beat={paused.beat} semanticOnly={false}/>);
  expect(paused.beat.melody).toBeUndefined();
});
it('flushes pause, bidirectional seek, replay and disposal while preserving ownership',async()=>{
  driver=createLeadCacheClock(audio,fixture,()=>{});media(false);await advance(400);expect(driver.snapshot().played).toBe(1);
  media(true);await advance(500);expect(driver.snapshot().played).toBe(1);expect(driver.snapshot().latest).toBe(.3);
  media(false,.9,'seeking');media(false,.9,'seeked');await advance(250);
  expect(driver.snapshot().latest).toBe(1);expect(driver.snapshot().owner).toBe('piano');
  media(false,0,'seeking');media(false,0,'seeked');await advance(400);expect(driver.snapshot().latest).toBe(.3);
  driver.dispose();expect(vi.getTimerCount()).toBe(0);
});
it('holds during buffering and follows rate changes without replaying queued Lead events',async()=>{
  driver=createLeadCacheClock(audio,fixture,()=>{});media(false);await advance(150);
  Object.defineProperty(audio,'readyState',{configurable:true,value:2});audio.dispatchEvent(new Event('waiting'));
  await vi.advanceTimersByTimeAsync(500);expect(driver.snapshot().played).toBe(0);
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});media(false);
  audio.playbackRate=2;audio.dispatchEvent(new Event('ratechange'));await advance(100);
  expect(driver.snapshot().latest).toBe(.3);expect(driver.snapshot().played).toBe(1);
  await advance(100);expect(driver.snapshot().played).toBe(1);
});
it('keeps missing and empty saved analysis explicit and silent while the original clock continues',async()=>{
  driver=createLeadCacheClock(audio,{...fixture,lead:undefined},()=>{});media(false);await advance(1500);
  expect(driver.snapshot().played).toBe(0);expect(audio.currentTime).toBeGreaterThan(1);
  expect(driver.snapshot().beat.leadAvailability).toBe('unavailable');
  driver.dispose();
  media(true,0);driver=createLeadCacheClock(audio,{...fixture,lead:[]},()=>{});media(false);await advance(1500);
  expect(driver.snapshot().played).toBe(0);expect(driver.snapshot().beat.onsets).toEqual({});
  expect(driver.snapshot().beat.leadAvailability).toBe('empty');expect(fetch).not.toHaveBeenCalled();
});
it('rejects malformed saved provenance instead of silently showing successful zero detection',async()=>{
  driver=createLeadCacheClock(audio,{...fixture,lead:[{...fixture.lead![0],inputSha256:undefined}]},()=>{});
  media(false);await advance(500);
  expect(driver.snapshot().beat.leadAvailability).toBe('failed');expect(driver.snapshot().played).toBe(0);
});
it.each([
  {...fixture,lead:[{...fixture.lead![0],end:31}]},
  {...fixture,start:31,lead:[]},
  {...fixture,lead:[{...fixture.lead![0],end:Number.NaN}]},
  {...fixture,lead:[fixture.lead![1],fixture.lead![0]]},
  {...fixture,lead:[{...fixture.lead![0],end:1.1},fixture.lead![1]]},
  {...fixture,end:60,lead:[{...fixture.lead![0],start:29.9,end:30.1},{...fixture.lead![1],start:30,end:30.2}]},
])('rejects invalid bounds or ordering before rendering saved notes',async invalid=>{
  driver=createLeadCacheClock(audio,invalid,()=>{});media(false);await advance(250);
  expect(driver.snapshot().beat.leadAvailability).toBe('failed');expect(driver.snapshot().played).toBe(0);
});
