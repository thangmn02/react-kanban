import { beatTelemetry } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('percussion-classifier');

export async function createPercussionRuntime({ context, source, onEvent, signal, onDiagnostic, classifier, onFailure = () => {}, onProgress = () => {} }) {
  if (signal?.aborted || !context.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  let live = true, worker, node, watchdog, timeout, pendingSince;
  let submittedTime = -Infinity;
  let resolveReady = () => {}, resolveCancelled;
  const cancelled = new Promise(resolve => { resolveCancelled = resolve; });
  const loadingAbort = new AbortController();
  const stop = () => {
    if (!live) return;
    live = false;
    clearTimeout(timeout); clearInterval(watchdog);
    loadingAbort.abort(); resolveReady(false); resolveCancelled(null);
    worker?.terminate();
    if (node) node.port.onmessage = null;
    node?.disconnect();
    signal?.removeEventListener('abort', stop);
    if (node) { try { source.disconnect(node); } catch { /* Graph may already be closed. */ } }
  };
  const fail = (reason = 'worker-failed') => {
    if (!live) return;
    stop();
    telemetry.record('EVENT_DROPPED', undefined, { reason });
    onFailure(reason);
  };
  // Bound the whole startup, including fetch/JSON and AudioWorklet.addModule.
  timeout = setTimeout(() => fail('worker-stalled'), 10000);
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) { stop(); return null; }

  const initialize = async () => {
    const response = await fetch(new URL('./generated/percussion/percussion.json', import.meta.url), { signal: loadingAbort.signal });
    if (!live || !response.ok) return null;
    const config = await response.json();
    if (['onset-guided','local-prominence'].includes(classifier)) config.classifier = classifier;
    if (!live || context.sampleRate !== config.sampleRate || config.version !== 1 || config.bins !== 84) return null;
    // Raw activations are private, explicitly requested diagnostics only.
    config.diagnostics = typeof onDiagnostic === 'function';
    // Timing-only instrumentation never requests raw scores or feature arrays.
    config.telemetry = beatTelemetry.enabled;
    worker = new Worker(new URL('./percussion-worker.js', import.meta.url), { type: 'module' });
    const ready = new Promise(resolve => { resolveReady = resolve; });
    worker.onerror = () => fail();
    worker.onmessage = ({ data }) => {
      if (!live) return;
      if (data.kind === 'ready') resolveReady(true);
      if (data.kind === 'failed') fail();
      if (data.kind === 'backlog') telemetry.record('EVENT_DROPPED', undefined, { reason: 'worker-backlog' });
      if (data.kind === 'result') {
        // Empty predictions prove inference is progressing through silence.
        pendingSince = data.processedAudioTime >= submittedTime ? undefined : performance.now();
        onProgress();
        telemetry.record('WORKER_BATCH', undefined, { ...data.timing, queueDepth: data.queueDepth, durationMs: data.durationMs,
          receivedAt: config.telemetry ? Date.now() : undefined });
        if (config.diagnostics) {
          try { onDiagnostic({ ...data, mainThreadReceivedAt: Date.now(), receivedAudioTime: context.currentTime }); }
          catch { /* Diagnostic observers cannot prevent semantic delivery. */ }
        }
        for (const event of data.events || []) onEvent(event);
      }
    };
    worker.postMessage({ kind: 'init', config, model: new URL('./generated/percussion/percussion.onnx', import.meta.url).href });
    if (!await ready || !live) return null;
    await context.audioWorklet.addModule(new URL('./percussion-worklet.js', import.meta.url));
    if (!live) return null;
    node = new AudioWorkletNode(context, 'kora-percussion-features', { processorOptions: config });
    node.port.onmessage = ({ data }) => {
      if (!live || !data.times?.length || !data.data?.buffer) return;
      submittedTime = data.times.at(-1);
      pendingSince ??= performance.now();
      if(config.diagnostics){
        try{onDiagnostic({kind:'features',times:data.times,data:Array.from(data.data),
          postedAt:data.postedAt,availableAudioTime:data.availableAudioTime,
          receivedAt:Date.now(),receivedAudioTime:context.currentTime});}
        catch{/* Private observers cannot block inference. */}
      }
      worker.postMessage(data, [data.data.buffer]);
    };
    source.connect(node); node.connect(context.destination);
    clearTimeout(timeout);
    // Allow slow devices headroom; suspension or absent input is not failure.
    watchdog = setInterval(() => {
      if (context.state === 'running' && pendingSince !== undefined && performance.now() - pendingSince > 2000) fail('worker-stalled');
    }, 250);
    return { stop };
  };
  try {
    const runtime = await Promise.race([initialize(), cancelled]);
    if (!runtime) stop();
    return runtime;
  } catch { fail(); return null; }
}
