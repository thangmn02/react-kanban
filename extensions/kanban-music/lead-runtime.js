import { LEAD_TRACKER_VERSION } from './lead-tracker.js';

const sameOwner = (a, b) => Boolean(a && b) && a.captureId === b.captureId && a.epoch === b.epoch;

/**
 * Attach the causal Lead tracker to an existing captured source. Returns null when the
 * browser cannot run it; callers keep the fifth row unavailable rather than guessing.
 */
export async function createLeadRuntime({ context, source, ownership, onEvent, onStats = () => {}, Node = globalThis.AudioWorkletNode }) {
  if (!context?.audioWorklet || !Node || !source) return null;
  await context.audioWorklet.addModule(new URL('./lead-tracker-worklet.js', import.meta.url));
  const node = new Node(context, 'kora-lead-tracker', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    processorOptions: { ownership } });
  let owner = ownership, live = true, events = 0, dropped = 0, lastStats;
  node.port.onmessage = ({ data }) => {
    if (!live || !sameOwner(data?.ownership, owner)) { if (data?.kind === 'events') dropped += data.events?.length || 0; return; }
    if (data.kind === 'stats') { lastStats = data; onStats(data); return; }
    if (data.kind !== 'events' || !Array.isArray(data.events) || data.events.length > 16) return;
    for (const event of data.events) {
      if (!Number.isFinite(event?.audioTime) || !Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1
        || !['start', 'change', 'repeat'].includes(event.kind)) continue;
      events++;
      onEvent({ audioTime: event.audioTime, decidedAt: event.decidedAt, kind: event.kind, confidence: event.confidence,
        ...(Number.isInteger(event.midiPitch) && event.midiPitch >= 0 && event.midiPitch <= 127 ? { midiPitch: event.midiPitch } : {}),
        receivedAudioTime: context.currentTime, version: data.version });
    }
  };
  // The node output is silent; connecting it keeps the processor pulled by the graph.
  const silent = context.createGain(); silent.gain.value = 0;
  source.connect(node); node.connect(silent); silent.connect(context.destination);
  return {
    version: LEAD_TRACKER_VERSION,
    /** New synchronization epoch: forget the followed note and accept only the new owner. */
    reset(next) { owner = next; node.port.postMessage({ kind: 'reset', ownership: next }); },
    get health() { return { ready: live, events, dropped, voicedFrames: lastStats?.voicedFrames ?? 0, busyMs: lastStats?.busyMs ?? null }; },
    stop() {
      if (!live) return; live = false;
      node.port.postMessage({ kind: 'stop' }); node.port.onmessage = null; node.port.close?.();
      try { source.disconnect(node); } catch { /* The capture graph may already be closed. */ }
      node.disconnect(); silent.disconnect();
    },
  };
}
