import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import LivePipelineTraceControl from './live-pipeline-trace-control';
import {captureLiveDiagnostics,MusicBridgeError} from './mediaBridge';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import type {BrowserMusicController} from './useBrowserMusic';
import {beatRowDiagnostics} from './beat-row-diagnostics';
vi.mock('./mediaBridge',async importOriginal=>({...await importOriginal<typeof import('./mediaBridge')>(),captureLiveDiagnostics:vi.fn()}));
const music={source:'extension-direct',selected:{id:'source',playing:true,syncState:{mode:'capture',captureId:'capture',capability:{privateCandidate:true,generation:1}}},
  beat:{onsets:{hat:0},mode:'capture'}} as BrowserMusicController;
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();beatTelemetry.enable(false);beatTelemetry.clear();vi.mocked(captureLiveDiagnostics).mockReset();});
it.each([0,1])('exports the acknowledged 90 second scope and fails closed for decision overflow %i',async decisionOverflow=>{
  vi.useFakeTimers();vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:long');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});const serialize=vi.spyOn(JSON,'stringify');
  const begin=Date.now();vi.mocked(captureLiveDiagnostics).mockImplementation(async(_id,request)=>({recording:{startedAt:begin,endsAt:begin+90000,
    status:request.operation==='start'?'RECORDING':'FINISHED',complete:request.operation==='read',counts:{frames:9000}},source:{clockOverflow:0,decisionOverflow}}));
  render(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));await vi.advanceTimersByTimeAsync(91400);});
  fireEvent.click(screen.getByRole('button',{name:'Export row trace'}));
  const snapshot=serialize.mock.calls.map(([value])=>value).find(value=>value?.liveDiagnostics);
  expect(snapshot.liveDiagnostics.applicationRecordsScope).toContain('+ 90 seconds');
  expect(snapshot.liveDiagnostics.commonWindow.epochEnd-snapshot.liveDiagnostics.commonWindow.epochStart).toBe(90000);
  expect(snapshot.complete).toBe(decisionOverflow===0);
});
it('uses accepted source generation when optional capability metadata disappears and still rejects replacement',async()=>{
  vi.useFakeTimers();const begin=Date.now();vi.mocked(captureLiveDiagnostics).mockResolvedValue({recording:{startedAt:begin,endsAt:begin+30000,status:'RECORDING'}});
  const fenced={...music,beat:{...music.beat,sourceGeneration:1,synchronizationEpoch:'epoch'}};
  const view=render(<LivePipelineTraceControl music={fenced}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  const refreshed={...fenced,selected:{...fenced.selected!,syncState:{...fenced.selected!.syncState!,capability:undefined}}};
  view.rerender(<LivePipelineTraceControl music={refreshed}/>);
  expect(screen.getByRole('status')).not.toHaveTextContent('ownership changed');
  view.rerender(<LivePipelineTraceControl music={{...fenced,beat:{...fenced.beat,sourceGeneration:2}}}/>);
  expect(screen.getByRole('status')).toHaveTextContent('ownership changed');
});
it('collects one complete synchronized export and blocks premature exports',async()=>{
  vi.useFakeTimers();vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:bundle');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  const startedAt=Date.now();vi.mocked(captureLiveDiagnostics).mockImplementation(async(_id,request)=>({recording:{startedAt,endsAt:startedAt+30000,status:request.operation==='start'?'RECORDING':'FINISHED',complete:request.operation==='read',counts:{frames:3100}},source:{videoId:'3q_ijl-aaTI',clockOverflow:0}}));
  render(<LivePipelineTraceControl music={music}/>);
  expect(screen.getByRole('button',{name:'Export row trace'})).toBeDisabled();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  expect(screen.getByRole('button',{name:'Export row trace'})).toBeDisabled();
  const trace=beatTelemetry.events('onset',['hat'])![0];beatTelemetry.record('EVENT_RECEIVED',trace);
  await act(async()=>{await vi.advanceTimersByTimeAsync(31400);});
  expect(screen.getByRole('status')).toHaveTextContent('3100 raw frames');
  fireEvent.click(screen.getByRole('button',{name:'Export row trace'}));expect(click).toHaveBeenCalledOnce();
  expect(vi.mocked(captureLiveDiagnostics).mock.calls.map(([,r])=>r.operation)).toEqual(['start','read']);
});
it('exports visual skip and clock evidence from before and during diagnostic capture',async()=>{
  vi.useFakeTimers();vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:motion');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});const serialize=vi.spyOn(JSON,'stringify');
  const begin=Date.now();vi.mocked(captureLiveDiagnostics).mockImplementation(async(_id,request)=>({recording:{startedAt:begin,endsAt:begin+30000,
    status:request.operation==='start'?'RECORDING':'FINISHED',complete:request.operation==='read',counts:{frames:3000}}}));
  const inspection=JSON.stringify({attempts:1,last:[{result:'expired',deadlineMs:begin-500,ageMs:500}]});
  render(<><div className="semantic-motion" data-motion-profile="focus" data-motion-reduced="false" data-motion-owner="active" data-motion-inputs="1" data-motion-inspection={inspection}/><LivePipelineTraceControl music={music}/></>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));await vi.advanceTimersByTimeAsync(31400);});
  fireEvent.click(screen.getByRole('button',{name:'Export row trace'}));
  const snapshot=serialize.mock.calls.map(([value])=>value).find(value=>value?.liveDiagnostics);
  expect(snapshot.visualPresentation.inspection.last[0].result).toBe('expired');
  expect(snapshot.liveDiagnostics.initialVisualPresentation.owner).toBe('active');
  expect(snapshot.liveDiagnostics.initialContext.controller.mode).toBe('capture');
});
it('aligns delayed start acknowledgement to one common window and restores telemetry after capture',async()=>{
  vi.useFakeTimers();beatTelemetry.enable(false);let release!:(value:Record<string,unknown>)=>void;
  vi.mocked(captureLiveDiagnostics).mockImplementation(async(_id,request)=>request.operation==='start'?new Promise(resolve=>{release=resolve;}):{recording:{status:'FINISHED',complete:false}});
  render(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);const startedAt=Date.now();release({recording:{startedAt,endsAt:startedAt+30000,status:'RECORDING'}});});
  const aligned=beatRowDiagnostics.snapshot();expect(aligned.startTime).toBe(Date.now());expect(aligned.endTime-aligned.startTime).toBe(31000);
  await act(async()=>{await vi.advanceTimersByTimeAsync(31350);});expect(beatTelemetry.enabled).toBe(false);
});
it('samples the declared render drain after the source audio window closes',async()=>{
  vi.useFakeTimers();const begin=Date.now();
  const frames=vi.spyOn(window,'requestAnimationFrame');
  vi.mocked(captureLiveDiagnostics).mockResolvedValue({recording:{startedAt:begin,endsAt:begin+30000,status:'RECORDING'}});
  render(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));await vi.advanceTimersByTimeAsync(30100);});
  const afterWindow=frames.mock.calls.length;
  await act(async()=>{await vi.advanceTimersByTimeAsync(500);});expect(frames.mock.calls.length).toBeGreaterThan(afterWindow);
  await act(async()=>{await vi.advanceTimersByTimeAsync(500);});const afterDrain=frames.mock.calls.length;
  await act(async()=>{await vi.advanceTimersByTimeAsync(100);});expect(frames.mock.calls.length).toBe(afterDrain);
});
it('reports unavailable raw capture rather than implying an empty recording proves misses',async()=>{
  vi.mocked(captureLiveDiagnostics).mockRejectedValue(Error('old companion'));
  render(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  expect(screen.getByRole('status')).toHaveTextContent('INCOMPLETE');expect(screen.getByRole('status')).toHaveTextContent('cannot explain model misses');
});
it('waits for actual detector readiness without requiring another owner click',async()=>{
  vi.useFakeTimers();const begin=Date.now();let attempts=0;
  vi.mocked(captureLiveDiagnostics).mockImplementation(async(_id,request)=>{
    if(request.operation==='start'&&attempts++===0)throw new MusicBridgeError('unavailable','detector-not-ready');
    return {recording:{startedAt:begin+1000,endsAt:begin+31000,status:'RECORDING'}};
  });
  render(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for the detector');
  await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
  expect(attempts).toBe(2);expect(screen.getByRole('status')).toHaveTextContent('Listen normally for 30 seconds');
});
it('refuses Hybrid ownership and stops only its diagnostic job on unmount',async()=>{
  const view=render(<LivePipelineTraceControl music={{...music,beta:{enabled:true} as BrowserMusicController['beta']}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));expect(captureLiveDiagnostics).not.toHaveBeenCalled();
  vi.mocked(captureLiveDiagnostics).mockResolvedValue({recording:{startedAt:Date.now(),endsAt:Date.now()+30000,status:'RECORDING'}});
  view.rerender(<LivePipelineTraceControl music={music}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Record 30 seconds'}));});
  view.unmount();expect(captureLiveDiagnostics).toHaveBeenLastCalledWith('source',expect.objectContaining({operation:'stop'}));
});
