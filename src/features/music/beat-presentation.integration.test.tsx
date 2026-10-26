import {act,cleanup,render,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import BeatPattern from './BeatPattern';
import {beatTelemetry,type BeatTrace} from '../../../extensions/kanban-music/beat-telemetry.js';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';
import {beatRowDiagnostics} from './beat-row-diagnostics';
import type {MusicBeatState} from './useMusicBeatSync';
import type {VisualAttack} from './semantic-motion';
import {usePresentationAttacks} from './use-presentation-attacks';

const session={id:'song',title:'',artist:'',source:'',generation:1,playing:true,paused:false,currentTime:0};
const base:MusicBeatState={sessionId:'song',mode:'capture',captureId:'capture',sourceGeneration:1,synchronizationEpoch:'a',onsets:{},visualAttacks:[]};
function attack(id:string,band:VisualAttack['band']='hat',offset=0):VisualAttack{
  const trace:BeatTrace={id,source:'onset',confidence:1,type:band==='clap'?'snare':band==='melody'?'melodic':band,
    detectedAt:Date.now()+offset,targetTime:Date.now()+offset,targetClock:'epoch-ms',targetPlaybackTime:1+offset/1000,eventSource:'local',captureId:'capture'};
  return {key:id,band,deadlineMs:trace.targetTime,trace};
}
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();beatTelemetry.enable(false);beatPresentationDiagnostics.clear();});

it.each([false,true])('retains every accepted same-row identity in a single React batch (semantic %s)',async semanticOnly=>{
  vi.useFakeTimers();beatRowDiagnostics.start();
  const view=render(<BeatPattern session={session} beat={base} semanticOnly={semanticOnly}/>);
  const attacks=[attack('a'),attack('b'),attack('c')];
  view.rerender(<BeatPattern session={session} beat={{...base,onsets:{hat:3},visualAttacks:attacks}} semanticOnly={semanticOnly}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(new Set(beatRowDiagnostics.snapshot().flashes.filter(f=>f.stage==='commit').map(f=>f.eventId))).toEqual(new Set(['a','b','c']));
  view.rerender(<BeatPattern session={session} beat={{...base,onsets:{hat:3},visualAttacks:attacks}} semanticOnly={semanticOnly}/>);
  expect(beatRowDiagnostics.snapshot().flashes.filter(f=>f.stage==='commit')).toHaveLength(3);
});

it('suppresses accepted identities during exclusive shapes and resumes only fresh attacks',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);beatRowDiagnostics.start();
  const view=render(<BeatPattern session={session} beat={base}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  const first=attack('entry','kick');
  view.rerender(<BeatPattern session={{...session,currentTime:36}} beat={{...base,onsets:{kick:1},visualAttacks:[first]}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-presentation-state','EXCLUSIVE_ACTIVE');
  expect(beatRowDiagnostics.snapshot().flashes.some(f=>f.eventId==='entry')).toBe(false);
  const hidden=attack('hidden');
  view.rerender(<BeatPattern session={{...session,currentTime:37}} beat={{...base,onsets:{kick:1,hat:1},visualAttacks:[first,hidden]}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('.semantic-beat-flash,.melody-beat-flash')).toBeNull();
  expect(beatPresentationDiagnostics.snapshot().records).toContainEqual(expect.objectContaining({key:'hidden',reason:'pattern-exclusive'}));
  expect(beatRowDiagnostics.snapshot().flashes.some(f=>f.eventId==='hidden')).toBe(false);
  await act(async()=>{await vi.advanceTimersByTimeAsync(9000);});
  expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-presentation-state','NORMAL');
  const fresh=attack('fresh');
  view.rerender(<BeatPattern session={{...session,currentTime:45}} beat={{...base,onsets:{kick:1,hat:2},visualAttacks:[first,hidden,fresh]}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('[data-event-id="fresh"]')).not.toBeNull();
  expect(view.container.querySelector('[data-event-id="hidden"]')).toBeNull();
});
it('retires exclusive timers when a live capture is replaced atomically',async()=>{
  vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  const view=render(<BeatPattern session={session} beat={base}/>);
  view.rerender(<BeatPattern session={{...session,currentTime:36}} beat={{...base,onsets:{kick:1},visualAttacks:[attack('shape-entry','kick')]}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-presentation-state','EXCLUSIVE_ACTIVE');
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  view.rerender(<BeatPattern session={{...session,generation:2}} beat={{...base,captureId:'replacement',sourceGeneration:2,synchronizationEpoch:'replacement'}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-presentation-state','NORMAL');
  expect(vi.getTimerCount()).toBe(0);
});

it.each([false,true])('presents the first fresh attack on an atomic source generation change (semantic %s)',async semanticOnly=>{
  vi.useFakeTimers();beatRowDiagnostics.start();
  const view=render(<BeatPattern session={session} beat={base} semanticOnly={semanticOnly}/>);
  const next={...base,sourceGeneration:2,captureId:'new-capture',synchronizationEpoch:'new',visualAttacks:[attack('new-generation')],onsets:{hat:1}};
  view.rerender(<BeatPattern session={{...session,generation:2}} beat={next} semanticOnly={semanticOnly}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('[data-event-id="new-generation"]')).not.toBeNull();
});

it.each([false,true])('keeps a future accepted attack hidden until its deadline (reduced %s)',async reduced=>{
  vi.useFakeTimers();const view=render(<BeatPattern session={session} beat={base} motionReduced={reduced}/>);
  view.rerender(<BeatPattern session={session} beat={{...base,visualAttacks:[attack('future','hat',100)]}} motionReduced={reduced}/>);
  const flash=view.container.querySelector<HTMLElement>('[data-event-id="future"]')!;
  expect(flash.style.visibility).toBe('hidden');expect(flash.style.animationFillMode).toBe('forwards');
  await act(async()=>{await vi.advanceTimersByTimeAsync(99);});expect(flash.style.visibility).toBe('hidden');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(flash.style.visibility).toBe('');
});
it('consumes a normalized legacy Lead received while hidden before the projection first becomes authoritative',()=>{
  vi.useFakeTimers();const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const lead=attack('hidden-lead','melody'),kick=attack('fresh-kick','kick');
  const hook=renderHook(({input,trace}:{input:readonly VisualAttack[]|undefined;trace:BeatTrace|undefined})=>
    usePresentationAttacks(input,'owner','semantic-only',undefined,true,trace,300),{initialProps:{input:undefined as readonly VisualAttack[]|undefined,trace:undefined as BeatTrace|undefined}});
  hidden.mockReturnValue(true);act(()=>document.dispatchEvent(new Event('visibilitychange')));
  hook.rerender({input:undefined,trace:lead.trace});
  hidden.mockReturnValue(false);act(()=>document.dispatchEvent(new Event('visibilitychange')));
  hook.rerender({input:[kick],trace:lead.trace});
  expect(hook.result.current.map(a=>a.key)).toEqual(['fresh-kick']);
});

it.each([false,true])('cancels on inactive view and mismatched source generation (semantic %s)',async semanticOnly=>{
  vi.useFakeTimers();const view=render(<BeatPattern session={session} beat={base} semanticOnly={semanticOnly}/>);
  const hit={...base,visualAttacks:[attack('active')],onsets:{hat:1}};
  view.rerender(<BeatPattern session={session} beat={hit} semanticOnly={semanticOnly}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(view.container.querySelector('[data-event-id="active"]')).not.toBeNull();
  view.rerender(<BeatPattern session={session} beat={hit} semanticOnly={semanticOnly} motionActive={false}/>);
  expect(view.container.querySelector('[data-event-id="active"]')).toBeNull();
  view.rerender(<BeatPattern session={{...session,generation:2}} beat={hit} semanticOnly={semanticOnly}/>);
  expect(view.container.querySelector('[data-event-id="active"]')).toBeNull();
});
