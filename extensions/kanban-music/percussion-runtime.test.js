import { afterEach, expect, it, vi } from 'vitest';
import { createPercussionRuntime } from './percussion-runtime.js';
import { beatTelemetry } from './beat-telemetry.js';
it('starts raw capture on demand without restarting the model or enabling feature dumps',async()=>{
  const f=fixture(),onCaptureDiagnostic=vi.fn(),onEvent=vi.fn(),ownership={captureId:'c',sourceId:'s',sourceGeneration:1,synchronizationEpoch:'e'};
  const loading=createPercussionRuntime({...f,onEvent,onCaptureDiagnostic,ownership});
  await Promise.resolve();await Promise.resolve();const worker=f.instances[0];
  expect(worker.postMessage.mock.calls[0][0].config.diagnostics).toBe(false);
  worker.onmessage({data:{kind:'ready',ownership}});const runtime=await loading;
  expect(runtime.recordDiagnostics('r',true)).toBe(true);
  expect(worker.postMessage).toHaveBeenLastCalledWith({kind:'diagnostic-capture',recordingId:'r',enabled:true,ownership});
  worker.onmessage({data:{kind:'diagnostic-start',diagnosticRecordingId:'r',ownership}});expect(onCaptureDiagnostic).toHaveBeenCalledOnce();
  worker.onmessage({data:{kind:'result',diagnosticRecordingId:'r',ownership:{...ownership,sourceGeneration:0},events:[{band:'hat'}]}});
  expect(onCaptureDiagnostic).toHaveBeenCalledOnce();expect(onEvent).not.toHaveBeenCalled();
  runtime.stop();expect(runtime.recordDiagnostics('r',false)).toBe(false);
});

it('fences PCM jobs and late inference results by exact source generation and aborts the old Worker',async()=>{
  const f=fixture(),onEvent=vi.fn(),onProgress=vi.fn(),controller=new AbortController();
  const ownership={captureId:'c',sourceId:'song-A',sourceGeneration:4,synchronizationEpoch:'epoch-4'};
  const loading=createPercussionRuntime({...f,onEvent,onProgress,ownership,signal:controller.signal});
  await Promise.resolve();await Promise.resolve();const worker=f.instances[0];
  worker.onmessage({data:{kind:'ready',ownership}});await loading;
  const input={times:[1],data:new Float32Array(84)};
  f.nodes[0].port.onmessage({data:{...input,ownership:{...ownership,sourceGeneration:3}}});
  expect(worker.postMessage).toHaveBeenCalledTimes(1);
  f.nodes[0].port.onmessage({data:{...input,ownership}});expect(worker.postMessage).toHaveBeenCalledTimes(2);
  const event={band:'hat',audioTime:1,confidence:.9,classMargin:.4};
  worker.onmessage({data:{kind:'result',events:[event],ownership:{...ownership,synchronizationEpoch:'old'}}});
  expect(onEvent).not.toHaveBeenCalled();expect(onProgress).not.toHaveBeenCalled();
  worker.onmessage({data:{kind:'result',events:[event],ownership}});expect(onEvent).toHaveBeenCalledWith({...event,...ownership});
  controller.abort();worker.onmessage({data:{kind:'result',events:[event],ownership}});
  expect(onEvent).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); beatTelemetry.enable(false); beatTelemetry.clear(); });
it('keeps shadow predictions unchanged and exposes separate guard decisions through diagnostics',async()=>{
  const f=fixture(),onEvent=vi.fn(),onDiagnostic=vi.fn();
  const loading=createPercussionRuntime({...f,onEvent,onDiagnostic,semanticPrecisionGuards:{mode:'shadow'}});
  await Promise.resolve();await Promise.resolve();const worker=f.instances[0];
  expect(worker.postMessage.mock.calls[0][0].config).toMatchObject({semanticPrecisionGuards:{mode:'shadow'},diagnostics:true});
  worker.onmessage({data:{kind:'ready'}});const runtime=await loading;
  const event={band:'hat',audioTime:1,confidence:.8,scores:[.2,.8,0,.8,.5]};
  const guardDecisions=[{audioTime:1,guard:{accept:true,wouldAccept:false},rawScores:event.scores}];
  worker.onmessage({data:{kind:'result',events:[event],guardDecisions}});
  expect(onEvent).toHaveBeenCalledWith(event);expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({guardDecisions}));
  runtime.stop();
});
function fixture() {
  const instances = [], nodes = [];
  class Worker {
    constructor() { this.terminate = vi.fn(); this.postMessage = vi.fn(); instances.push(this); }
  }
  class Node {
    constructor() { this.port = {}; this.connect = vi.fn(); this.disconnect = vi.fn(); nodes.push(this); }
  }
  vi.stubGlobal('Worker', Worker); vi.stubGlobal('AudioWorkletNode', Node);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, bins: 84, sampleRate: 44100 }) })));
  const context = { sampleRate: 44100, state: 'running', audioWorklet: { addModule: vi.fn(async () => {}) }, destination: {} };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  return { instances, nodes, context, source };
}
it('enables timing-only worker evidence without enabling raw model data', async () => {
  const f = fixture(); beatTelemetry.enable();
  const loading = createPercussionRuntime({ ...f, onEvent() {} });
  await Promise.resolve(); await Promise.resolve();
  const worker = f.instances[0];
  expect(worker.postMessage.mock.calls[0][0].config).toMatchObject({ telemetry: true, diagnostics: false });
  worker.onmessage({ data: { kind: 'ready' } }); const runtime = await loading;
  worker.onmessage({ data: { kind: 'result', events: [], queueDepth: 0, durationMs: 10,
    timing: { inferenceStartedAt: 100, inferenceEndedAt: 110, modelInputAudioTime: 2, scores: [.9] } } });
  expect(beatTelemetry.snapshot().records.at(-1)).toMatchObject({ stage: 'WORKER_BATCH', inferenceStartedAt: 100, inferenceEndedAt: 110 });
  expect(JSON.stringify(beatTelemetry.snapshot())).not.toContain('scores');
  runtime.stop();
});
it('reports a post-ready failure once and releases inference without accepting old results', async () => {
  vi.useFakeTimers(); const f = fixture(), onFailure = vi.fn(), onEvent = vi.fn();
  const loading = createPercussionRuntime({ ...f, onFailure, onEvent });
  await Promise.resolve(); await Promise.resolve();
  const worker = f.instances[0]; worker.onmessage({ data: { kind: 'ready' } });
  const runtime = await loading;
  worker.onmessage({ data: { kind: 'failed' } });
  worker.onerror(); runtime.stop();
  worker.onmessage({ data: { kind: 'result', events: [{ band: 'hat', audioTime: 1 }] } });
  expect(onFailure).toHaveBeenCalledExactlyOnceWith('worker-failed');
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(f.nodes[0].disconnect).toHaveBeenCalledOnce();
  expect(onEvent).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('recovers a hung inference only after actual input has stopped progressing', async () => {
  vi.useFakeTimers(); const f = fixture(), onFailure = vi.fn();
  const loading = createPercussionRuntime({ ...f, onFailure, onEvent() {} });
  await Promise.resolve(); await Promise.resolve();
  f.instances[0].onmessage({ data: { kind: 'ready' } });
  await loading;
  await vi.advanceTimersByTimeAsync(3000);
  expect(onFailure).not.toHaveBeenCalled();
  f.nodes[0].port.onmessage({ data: { times: [1], data: new Float32Array(84) } });
  await vi.advanceTimersByTimeAsync(2300);
  expect(onFailure).toHaveBeenCalledExactlyOnceWith('worker-stalled');
  expect(f.instances[0].terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(['fetch', 'worklet'])('bounds a stalled %s initialization and ignores its late completion', async stage => {
  vi.useFakeTimers(); const f = fixture(), onFailure = vi.fn();
  let finish;
  if (stage === 'fetch') fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  else f.context.audioWorklet.addModule.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const loading = createPercussionRuntime({ ...f, onFailure, onEvent() {} });
  await Promise.resolve(); await Promise.resolve();
  if (stage === 'worklet') {
    f.instances[0].onmessage({ data: { kind: 'ready' } });
    await Promise.resolve(); await Promise.resolve();
  }
  await vi.advanceTimersByTimeAsync(10001);
  expect(await loading).toBeNull();
  expect(onFailure).toHaveBeenCalledExactlyOnceWith('worker-stalled');
  finish(stage === 'fetch' ? { ok: true, json: async () => ({ version: 1, bins: 84, sampleRate: 44100 }) } : undefined);
  await Promise.resolve(); await Promise.resolve();
  expect(f.source.connect).not.toHaveBeenCalled();
  expect(f.nodes).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
});
it('counts empty inference results as progress and does not mistake silence for a stall', async () => {
  vi.useFakeTimers(); const f = fixture(), onFailure = vi.fn(), onProgress = vi.fn();
  const loading = createPercussionRuntime({ ...f, onFailure, onProgress, onEvent() {} });
  await Promise.resolve(); await Promise.resolve();
  f.instances[0].onmessage({ data: { kind: 'ready' } });
  const runtime = await loading;
  for (let time = 1; time <= 10; time++) {
    f.nodes[0].port.onmessage({ data: { times: [time], data: new Float32Array(84) } });
    await vi.advanceTimersByTimeAsync(300);
    f.instances[0].onmessage({ data: { kind: 'result', processedAudioTime: time, events: [] } });
  }
  await vi.advanceTimersByTimeAsync(3000);
  expect(onFailure).not.toHaveBeenCalled(); expect(onProgress).toHaveBeenCalledTimes(10);
  runtime.stop(); expect(vi.getTimerCount()).toBe(0);
});
it('fails closed without the learned model or compatible frontend, keeping the graph untouched', async () => {
  const f = fixture();
  fetch.mockResolvedValueOnce({ ok: false });
  expect(await createPercussionRuntime({ ...f, onEvent() {} })).toBeNull();
  expect(f.instances).toHaveLength(0); expect(f.source.connect).not.toHaveBeenCalled();
  f.context.sampleRate = 48000;
  expect(await createPercussionRuntime({ ...f, onEvent() {} })).toBeNull();
  expect(f.instances).toHaveLength(0);
});
it('terminates a loading worker immediately when capture is aborted, without waiting for its timeout', async () => {
  vi.useFakeTimers(); const f = fixture(), controller = new AbortController();
  const loading = createPercussionRuntime({ ...f, onEvent() {}, signal: controller.signal });
  await Promise.resolve(); await Promise.resolve();
  expect(f.instances).toHaveLength(1);
  controller.abort(); expect(await loading).toBeNull();
  expect(f.instances[0].terminate).toHaveBeenCalled();
  expect(f.source.connect).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('delivers scored results from one worker and prevents post-stop results from escaping', async () => {
  const f = fixture(), onEvent = vi.fn();
  const loading = createPercussionRuntime({ ...f, onEvent });
  await Promise.resolve(); await Promise.resolve();
  const worker = f.instances[0]; worker.onmessage({ data: { kind: 'ready' } });
  const runtime = await loading;
  const event = { band: 'kick', audioTime: 1, confidence: .9, classMargin: .4 };
  worker.onmessage({ data: { kind: 'result', events: [event], queueDepth: 0, durationMs: 20 } });
  expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
  runtime.stop(); worker.onmessage({ data: { kind: 'result', events: [event] } });
  expect(onEvent).toHaveBeenCalledOnce(); expect(worker.terminate).toHaveBeenCalled();
  expect(f.source.disconnect).toHaveBeenCalledWith(f.source.connect.mock.calls[0][0]);
});
it('requests raw timing diagnostics only explicitly and keeps delivery alive when an observer throws', async () => {
  const f = fixture(), onEvent = vi.fn(), onDiagnostic = vi.fn(() => { throw new Error('observer'); });
  const loading = createPercussionRuntime({ ...f, onEvent, onDiagnostic });
  await Promise.resolve(); await Promise.resolve();
  const worker = f.instances[0];
  expect(worker.postMessage.mock.calls[0][0].config.diagnostics).toBe(true);
  worker.onmessage({ data: { kind: 'ready' } });
  const runtime = await loading;
  const features={times:[1],data:new Float32Array(84).fill(.5)};
  f.nodes[0].port.onmessage({data:features});
  expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({kind:'features',times:[1],data:Array(84).fill(.5)}));
  expect(worker.postMessage).toHaveBeenLastCalledWith(features,[features.data.buffer]);
  const event = { band: 'hat', audioTime: 1, confidence: .8, classMargin: .3 };
  worker.onmessage({ data: { kind: 'result', events: [event], diagnostics: [], durationMs: 10, queueDepth: 0 } });
  expect(onDiagnostic).toHaveBeenCalledTimes(2); expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
  runtime.stop();
});
