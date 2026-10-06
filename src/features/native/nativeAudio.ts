import { Channel, invoke } from '@tauri-apps/api/core';
import { createNativeAudioEngine, type NativeAudioEngine } from '../../../extensions/kanban-music/native-audio-engine.js';

type Message = Record<string, unknown>;
interface Subscription {
  sessionId: string; subscriptionId: string; playing: boolean; clockAt: number;
  captureId?: string; engine?: NativeAudioEngine; starting?: boolean; audible?: boolean;
  sequence: number; beatSequence: number; retryAt: number; heartbeat?: ReturnType<typeof setInterval>;
  previousClock?: { currentTime: number; playbackRate: number; sampledAt: number };
}

export function decodeNativeAudio(value: unknown): { sequence: number; samples: Float32Array } | undefined {
  if (!(value instanceof ArrayBuffer) || value.byteLength < 24 || value.byteLength > 352816) return;
  const view = new DataView(value);
  const sequence = Number(view.getBigUint64(0, true)), frames = view.getUint32(8, true);
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || !frames || frames > 44100
    || view.getUint32(12, true) !== 44100 || value.byteLength !== 16 + frames * 8) return;
  const samples = new Float32Array(value, 16);
  if (samples.some((sample) => !Number.isFinite(sample) || Math.abs(sample) > 1)) return;
  return { sequence, samples };
}

export function createNativeAudioFeed(publish: (message: Message) => void) {
  let current: Subscription | undefined;
  const clocks = new Map<string, Message>();
  const key = (session: string, subscription: string) => `${session}/${subscription}`;
  const emit = (owner: Subscription, fields: Message) => {
    if (current === owner) publish({ ...fields, sessionId: owner.sessionId, subscriptionId: owner.subscriptionId,
      captureId: owner.captureId, emittedAt: Date.now() });
  };
  function halt(owner: Subscription, reason: string) {
    const id = owner.captureId, engine = owner.engine;
    owner.engine = undefined; owner.captureId = undefined; owner.audible = false; owner.starting = false;
    clearInterval(owner.heartbeat); owner.heartbeat = undefined;
    engine?.stop();
    if (id) void invoke('native_audio_stop', { captureId: id }).catch(() => {});
    emit(owner, { kind: 'sync.state', mode: 'clock', reason });
  }
  async function begin(owner: Subscription) {
    if (current !== owner || !owner.playing || owner.engine || owner.starting || Date.now() < owner.retryAt) return;
    owner.starting = true; owner.captureId = crypto.randomUUID();
    owner.sequence = 0; owner.beatSequence = 0;
    const id = owner.captureId;
    emit(owner, { kind: 'sync.state', mode: 'clock', reason: 'starting' });
    const engine = createNativeAudioEngine({
      onBeat: (_, bands) => { if (owner.captureId === id) emit(owner, { kind: 'onset', bands, sequence: ++owner.beatSequence }); },
      onTempo: (_, tempo) => { if (owner.captureId === id) emit(owner, { kind: 'tempo.state', tempo }); },
      onTempoTick: (_, tick) => { if (owner.captureId === id) emit(owner, { kind: 'tempo.tick', tick }); },
      onMelody: (_, melody) => { if (owner.captureId === id) emit(owner, { kind: 'melody.state', detector: 'instrument-v1', melody }); },
      onAudible: () => { if (owner.captureId === id) { owner.audible = true; emit(owner, { kind: 'sync.state', mode: 'capture' }); } },
      onStop: (_, reason) => { if (owner.captureId === id) { owner.retryAt = Date.now() + 3000; halt(owner, reason); } },
    });
    owner.engine = engine;
    try {
      if (!await engine.start(id)) throw new Error('capture-failed');
      if (current !== owner || owner.captureId !== id) return;
      const channel = new Channel<ArrayBuffer>();
      channel.onmessage = (value) => {
        if (current !== owner || owner.captureId !== id) return;
        const packet = decodeNativeAudio(value);
        if (!packet || packet.sequence !== owner.sequence + 1 || !engine.push(packet.samples)) {
          owner.retryAt = Date.now() + 3000; halt(owner, 'audio-backlog'); return;
        }
        owner.sequence = packet.sequence;
      };
      await invoke('native_audio_start', { sessionId: owner.sessionId, captureId: id, onAudio: channel });
      if (current !== owner || owner.captureId !== id) { void invoke('native_audio_stop', { captureId: id }).catch(() => {}); return; }
      owner.starting = false;
      owner.heartbeat = setInterval(() => {
        if (current !== owner || owner.captureId !== id) return;
        if (!owner.playing || Date.now() - owner.clockAt > 3000 || !engine.renew(id)) { halt(owner, 'clock-disconnected'); return; }
        void invoke('native_audio_renew', { captureId: id, sequence: owner.sequence }).catch(() => {
          if (owner.captureId === id) { owner.retryAt = Date.now() + 3000; halt(owner, 'capture-disconnected'); }
        });
        if (owner.audible) emit(owner, { kind: 'sync.state', mode: 'capture' });
      }, 500);
    } catch {
      if (owner.captureId === id) { owner.retryAt = Date.now() + 3000; halt(owner, 'native-capture-unavailable'); }
    }
  }
  function clock(owner: Subscription, message: Message) {
    const data = message.clock as Record<string, unknown>;
    const currentTime = Number(data.currentTime), playbackRate = Number(data.playbackRate), sampledAt = Number(data.sampledAt);
    if (![currentTime, playbackRate, sampledAt].every(Number.isFinite) || currentTime < 0 || playbackRate <= 0) return;
    const previous = owner.previousClock;
    if (owner.playing && data.playing === true && previous
      && (playbackRate !== previous.playbackRate || Math.abs(currentTime - previous.currentTime
        - Math.max(0, sampledAt - previous.sampledAt) / 1000 * previous.playbackRate) > .75)) {
      halt(owner, 'track-changed'); owner.retryAt = 0;
    }
    owner.previousClock = { currentTime, playbackRate, sampledAt };
    owner.clockAt = Date.now();
    owner.playing = data.playing === true && data.paused === false && data.muted !== true;
    if (!owner.playing) halt(owner, data.muted ? 'muted' : 'not-playing');
    else void begin(owner);
  }
  return {
    companion(message: unknown): boolean {
      if (!message || typeof message !== 'object') return true;
      const data = message as Message;
      if (typeof data.sessionId !== 'string' || typeof data.subscriptionId !== 'string') return true;
      const stamp = data.emittedAt;
      if (typeof stamp !== 'number' || !Number.isFinite(stamp) || Date.now() - stamp > 600 || stamp > Date.now() + 100) return false;
      if (data.kind === 'clock' && data.clock && typeof data.clock === 'object') {
        const state = data.clock as Message;
        if (typeof state.playing !== 'boolean' || typeof state.paused !== 'boolean') return false;
        clocks.set(key(data.sessionId, data.subscriptionId), data);
        if (clocks.size > 16) clocks.delete(clocks.keys().next().value!);
        if (current?.sessionId === data.sessionId && current.subscriptionId === data.subscriptionId) clock(current, data);
        return true;
      }
      // The Companion remains the clock/control transport. Its clock-only
      // status cannot overwrite analyser-confirmed native capture.
      return !(current?.sessionId === data.sessionId && current.subscriptionId === data.subscriptionId && data.kind !== 'clock');
    },
    activate(sessionId: string, subscriptionId: string) {
      if (current?.sessionId !== sessionId || current.subscriptionId !== subscriptionId) {
        if (current) halt(current, 'replaced');
        current = { sessionId, subscriptionId, playing: false, clockAt: 0, sequence: 0, beatSequence: 0, retryAt: 0 };
      }
      const cached = clocks.get(key(sessionId, subscriptionId));
      if (cached && Date.now() - Number(cached.emittedAt) < 1000) clock(current, cached);
    },
    stop(sessionId: string, subscriptionId: string) {
      if (current?.sessionId !== sessionId || current.subscriptionId !== subscriptionId) return;
      halt(current, 'stopped'); current = undefined;
      clocks.delete(key(sessionId, subscriptionId));
    },
    ended(value: unknown) {
      if (!value || typeof value !== 'object' || !current) return;
      const event = value as Message;
      if (current.captureId !== event.captureId) return;
      current.retryAt = Date.now() + 3000;
      halt(current, typeof event.reason === 'string' ? event.reason : 'capture-failed');
    },
  };
}
