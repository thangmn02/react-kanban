import { parseMediaAsset, type MediaAsset } from '../../../extensions/kanban-music/media-asset.js';
import { clockAdvancing, parsePlaybackClock, type PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';
import { leadProcessingEnabled } from './lead-feature';
import { readCompanionAudio } from './mediaBridge';

export function companionLeadInputEnabled(asset?: MediaAsset) {
  if (!import.meta.env.DEV || !leadProcessingEnabled() || asset?.provider !== 'kora-development') return false;
  const [provider, ...id] = (import.meta.env.VITE_LEAD_AUDIO_TEST_ASSET || '').split(':');
  const allowed = parseMediaAsset({ provider, id: id.join(':') });
  return Boolean(allowed && allowed.provider === asset.provider && allowed.id === asset.id);
}

export function decodeCompanionAudio(value: unknown, asset: MediaAsset) {
  if (!value || typeof value !== 'object') return;
  const packet = value as Record<string, unknown>, identity = parseMediaAsset(packet.asset);
  const clock = parsePlaybackClock(packet.clock);
  if (!identity || identity.provider !== asset.provider || identity.id !== asset.id || !clock
    || !clockAdvancing(clock) || clock.playbackRate !== 1 || (packet.clock as Record<string, unknown>).muted === true
    || Date.now() - clock.sampledAt > 500 || clock.sampledAt > Date.now() + 100
    || typeof packet.captureId !== 'string' || !packet.captureId || packet.captureId.length > 100
    || !Number.isSafeInteger(packet.sequence) || Number(packet.sequence) <= 0
    || typeof packet.pcm !== 'string' || packet.pcm.length !== 23520) return;
  let binary;
  try { binary = atob(packet.pcm); } catch { return; }
  if (binary.length !== 17640) return;
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0)), view = new DataView(bytes.buffer);
  const samples = new Float32Array(17640);
  for (let index = 0; index < 8820; index++) {
    samples[index * 2] = samples[index * 2 + 1] = view.getInt16(index * 2, true) / 32768;
  }
  bytes.fill(0);
  return { samples, clock, captureId: packet.captureId, sequence: Number(packet.sequence) };
}

// One pull in flight; no raw packet queue. The existing segment buffer owns
// resampling and drops incomplete input after clock/owner discontinuities.
export function startCompanionLeadAudio(sessionId: string, subscriptionId: string, asset: MediaAsset,
  receive: (samples: Float32Array, clock: PlaybackClock) => void, reset: () => void,
  needed: () => boolean, read = readCompanionAudio) {
  let stopped = false, owner = '', sequence = 0;
  let timer: ReturnType<typeof setTimeout>;
  async function poll() {
    if (stopped) return;
    if (!needed()) { reset(); owner = ''; sequence = 0; }
    else {
      try {
        const raw = await read(sessionId, subscriptionId);
        if (stopped) return;
        const packet = decodeCompanionAudio(raw, asset);
        if (!needed()) { packet?.samples.fill(0); reset(); owner = ''; sequence = 0; }
        else if (packet) {
          if (owner !== packet.captureId || packet.sequence !== sequence + 1) reset();
          if (owner === packet.captureId && packet.sequence <= sequence) packet.samples.fill(0);
          else {
            owner = packet.captureId; sequence = packet.sequence;
            try { receive(packet.samples, packet.clock); } finally { packet.samples.fill(0); }
          }
        } else if (raw) { reset(); owner = ''; sequence = 0; }
      } catch { reset(); owner = ''; sequence = 0; }
    }
    if (!stopped) timer = setTimeout(() => { void poll(); }, 100);
  }
  void poll();
  return () => { stopped = true; clearTimeout(timer); reset(); };
}
