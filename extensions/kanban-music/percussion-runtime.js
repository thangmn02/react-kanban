import { beatTelemetry } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('percussion-classifier');
export async function createPercussionRuntime({ context, source, onEvent, signal, onDiagnostic }) {
  if (signal?.aborted) return null;
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  const response = await fetch(new URL('./generated/percussion/percussion.json', import.meta.url), { signal });
  if (!response.ok) {
    fetch('http://localhost:12345/', { method: 'POST', body: 'json fetch failed: ' + response.status }).catch(() => {});
    return null;
  }
  const config = await response.json();
  // Raw learned activations are private, explicitly requested diagnostics only.
  config.diagnostics = typeof onDiagnostic === 'function';
  if (context.sampleRate !== config.sampleRate || config.version !== 1 || config.bins !== 84) {
    fetch('http://localhost:12345/', { method: 'POST', body: `Config mismatch: cSR=${context.sampleRate} c.v=${config.version} c.b=${config.bins}` }).catch(() => {});
    return null;
  }
  let live = true;
  let resolveReady;
  let timeout;
  const worker = new Worker(new URL('./percussion-worker.js', import.meta.url), { type: 'module' });
  let node;
  const stop = () => {
    live = false;
    clearTimeout(timeout);
    resolveReady(false);
    worker.terminate();
    if (node) node.port.onmessage = null;
    node?.disconnect();
    signal?.removeEventListener('abort', stop);
    if (node) { try { source.disconnect(node); } catch { /* Graph may already be closed. */ } }
  };
  const ready = new Promise(resolve => { resolveReady = resolve; });
  timeout = setTimeout(() => resolveReady(false), 10000);
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) { stop(); return null; }
  worker.onerror = () => { resolveReady(false); stop(); };
  worker.onmessage = ({ data }) => {
    if (!live) return;
    if (data.kind === 'ready') resolveReady(true);
    if (data.kind === 'failed') { telemetry.record('EVENT_DROPPED', undefined, { reason: 'worker-failed' }); resolveReady(false); stop(); }
    if (data.kind === 'backlog') telemetry.record('EVENT_DROPPED', undefined, { reason: 'worker-backlog' });
    if (data.kind === 'result') {
      telemetry.record('WORKER_BATCH', undefined, { queueDepth: data.queueDepth, durationMs: data.durationMs });
      if (config.diagnostics) {
        try { onDiagnostic({ ...data, mainThreadReceivedAt: Date.now(), receivedAudioTime: context.currentTime }); }
        catch { /* Diagnostic consumers cannot prevent semantic delivery. */ }
      }
      for (const event of data.events || []) onEvent(event);
    }
  };
  worker.postMessage({ kind: 'init', config, model: new URL('./generated/percussion/percussion.onnx', import.meta.url).href });
  if (!await ready) { 
    fetch('http://localhost:12345/', { method: 'POST', body: 'worker ready timeout or failed' }).catch(() => {});
    stop(); return null; 
  }
  clearTimeout(timeout);
  try {
    await context.audioWorklet.addModule(new URL('./percussion-worklet.js', import.meta.url));
    if (!live) return null;
    node = new AudioWorkletNode(context, 'kora-percussion-features', { processorOptions: config });
    node.port.onmessage = ({ data }) => { if (live) worker.postMessage(data, [data.data.buffer]); };
    source.connect(node); node.connect(context.destination);
    return { stop };
  } catch (e) {
    stop();
    fetch('http://localhost:12345/', { method: 'POST', body: 'percussion-runtime.js error: ' + (e?.stack || e) }).catch(() => {});
    return null;
  }
}
