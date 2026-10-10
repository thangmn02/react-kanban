import { Channel, invoke } from '@tauri-apps/api/core';
import { createNativeAudioEngine, type NativeAudioEngine } from '../../../extensions/kanban-music/native-audio-engine.js';
import { beatTelemetry, parseBeatTraces, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import { playbackTiming, playbackTraces, parsePlaybackTiming, parsePlaybackClock, clockDiscontinuity, clockAdvancing, playbackDeadline, type OutputTiming, type PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';
const telemetry = beatTelemetry.at('native-audio-feed');

type Message = Record<string, unknown>;
interface Subscription {
  sessionId: string; subscriptionId: string; playing: boolean; clockAt: number;
  captureId?: string; engine?: NativeAudioEngine; starting?: boolean; audible?: boolean;
  sequence: number; beatSequence: number; retryAt: number; heartbeat?: ReturnType<typeof setInterval>;
  previousClock?: PlaybackClock;
  recoveryReason?: string;
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

export function createNativeAudioFeed(publish: (message: Message) => void,
  onAudio?: (sessionId: string, samples: Float32Array, clock: PlaybackClock) => void) {
  let current: Subscription | undefined;
  const clocks = new Map<string, Message>();
  const key = (session: string, subscription: string) => `${session}/${subscription}`;
  const emit = (owner: Subscription, fields: Message) => {
    telemetry.mark(current === owner ? 'EVENT_SENT' : 'EVENT_DROPPED', parseBeatTraces(fields.telemetry), current === owner ? {} : { reason: 'owner' });
    if (current === owner) publish({ ...fields, sessionId: owner.sessionId, subscriptionId: owner.subscriptionId,
      captureId: owner.captureId, emittedAt: Date.now() });
  };
  function halt(owner: Subscription, reason: string) {
    telemetry.record('CAPTURE_STOP', undefined, { captureId: owner.captureId, reason });
    const id = owner.captureId, engine = owner.engine;
    if (id && owner.playing && !['stopped', 'replaced'].includes(reason)) owner.recoveryReason = reason;
    owner.engine = undefined; owner.captureId = undefined; owner.audible = false; owner.starting = false;
    clearInterval(owner.heartbeat); owner.heartbeat = undefined;
    engine?.stop();
    if (id) void invoke('native_audio_stop', { captureId: id }).catch(() => {});
    emit(owner, { kind: 'sync.state', mode: 'clock', reason });
  }
  async function begin(owner: Subscription) {
    if (current !== owner || !owner.playing || owner.engine || owner.starting || Date.now() < owner.retryAt) return;
    owner.starting = true; owner.captureId = crypto.randomUUID();
    telemetry.record('CAPTURE_START', undefined, { captureId: owner.captureId });
    owner.sequence = 0; owner.beatSequence = 0;
    const id = owner.captureId;
    const diagnostic = (traces?: BeatTrace[], output?: OutputTiming) => {
      const timing = owner.previousClock && playbackTiming(owner.previousClock, output);
      const mapped = playbackTraces(traces, timing || undefined, output?.targetOutputTime);
      return { ...(mapped ? { telemetry: mapped.map((trace) => ({ ...trace, captureId: id })) } : {}), ...(timing || {}) };
    };
    emit(owner, { kind: 'sync.state', mode: 'clock', reason: 'starting' });
    const engine = createNativeAudioEngine({
      onBeat: (_, bands, traces, timing) => { if (owner.captureId === id) emit(owner, { kind: 'onset', bands, sequence: ++owner.beatSequence, ...diagnostic(traces, timing) }); },
      onTempo: (_, tempo, traces, timing) => { if (owner.captureId === id) emit(owner, { kind: 'tempo.state', tempo, ...diagnostic(traces, timing) }); },
      onTempoTick: (_, tick, traces, timing) => { if (owner.captureId === id) emit(owner, { kind: 'tempo.tick', tick, ...diagnostic(traces, timing) }); },
      onAudible: () => { if (owner.captureId === id) {
        owner.audible = true;
        if (owner.recoveryReason) { telemetry.record('CAPTURE_RECOVERED', undefined, { captureId: id, reason: owner.recoveryReason }); owner.recoveryReason = undefined; }
        emit(owner, { kind: 'sync.state', mode: 'capture' });
      } },
      onStop: (_, reason) => { if (owner.captureId === id) { owner.retryAt = reason === 'failed' ? Date.now() + 3000 : 0; halt(owner, reason); } },
    });
    owner.engine = engine;
    try {
      if (!await engine.start(id)) throw new Error('capture-failed');
      if (current !== owner || owner.captureId !== id) return;
      const channel = new Channel<ArrayBuffer>();
      channel.onmessage = (value) => {
        if (current !== owner || owner.captureId !== id) return;
        const packet = decodeNativeAudio(value);
        telemetry.record('EVENT_RECEIVED', undefined, { captureId: id, sequence: packet?.sequence, frames: packet ? packet.samples.length / 2 : undefined });
        if (!packet || packet.sequence !== owner.sequence + 1 || !engine.push(packet.samples, ...(beatTelemetry.enabled ? [{ sequence: packet.sequence }] : []))) {
          telemetry.record('EVENT_DROPPED', undefined, { captureId: id, reason: !packet ? 'invalid' : 'audio-backlog', sequence: packet?.sequence });
          owner.retryAt = 0; halt(owner, 'audio-backlog'); return;
        }
        owner.sequence = packet.sequence;
        if (owner.previousClock && owner.playing) onAudio?.(owner.sessionId, packet.samples, owner.previousClock);
      };
      await invoke('native_audio_start', { sessionId: owner.sessionId, captureId: id, onAudio: channel,
        ...(beatTelemetry.enabled ? { telemetryEnabled: true } : {}) });
      if (current !== owner || owner.captureId !== id) { void invoke('native_audio_stop', { captureId: id }).catch(() => {}); return; }
      owner.starting = false;
      owner.heartbeat = setInterval(() => {
        if (current !== owner || owner.captureId !== id) return;
        if (!owner.playing || Date.now() - owner.clockAt > 3000 || !engine.renew(id)) { halt(owner, 'clock-disconnected'); return; }
        void invoke('native_audio_renew', { captureId: id, sequence: owner.sequence }).then(() => {
          telemetry.record('LEASE_RENEW', undefined, { captureId: id, sequence: owner.sequence });
        }).catch(() => {
          telemetry.record('LEASE_EXPIRED', undefined, { captureId: id, reason: 'capture-disconnected' });
          if (owner.captureId === id) { owner.retryAt = 0; halt(owner, 'capture-disconnected'); }
        });
        if (owner.audible) emit(owner, { kind: 'sync.state', mode: 'capture' });
      }, 500);
    } catch {
      if (owner.captureId === id) { owner.retryAt = Date.now() + 3000; halt(owner, 'native-capture-unavailable'); }
    }
  }
  function clock(owner: Subscription, message: Message) {
    const data = message.clock as Record<string, unknown>;
    const normalized = parsePlaybackClock(data);
    if (!normalized || owner.previousClock && normalized.sampledAt < owner.previousClock.sampledAt) return;
    const { playbackRate } = normalized;
    const previous = owner.previousClock;
    if (clockDiscontinuity(previous, normalized) || owner.playing && data.playing === true && previous
      && playbackRate !== previous.playbackRate) {
      halt(owner, 'track-changed'); owner.retryAt = 0;
    }
    owner.previousClock = normalized;
    owner.clockAt = Date.now();
    const playing = clockAdvancing(normalized) && data.muted !== true;
    if (playing && !owner.playing) owner.retryAt = 0;
    owner.playing = playing;
    if (!owner.playing) halt(owner, data.muted ? 'muted' : 'not-playing');
    else void begin(owner);
  }
  return {
    companion(message: unknown): boolean {
      if (!message || typeof message !== 'object') return true;
      const data = message as Message;
      if (typeof data.sessionId !== 'string' || typeof data.subscriptionId !== 'string') return true;
      const stamp = data.emittedAt;
      if (typeof stamp !== 'number' || !Number.isFinite(stamp) || stamp > Date.now() + 100) { telemetry.record('EVENT_DROPPED', undefined, { reason: 'invalid' }); return false; }
      if (Date.now() - stamp > 600) telemetry.record('EVENT_LATE', undefined, { delayMs: Date.now() - stamp });
      const timing = parsePlaybackTiming(data);
      const deadline = timing && playbackDeadline(timing);
      const ahead = deadline !== undefined && deadline >= Date.now() && deadline <= Date.now() + 8000;
      if (Date.now() - stamp > 2000 && !ahead) {
        telemetry.mark('EVENT_DROPPED', parseBeatTraces(data.telemetry), { reason: 'late' });
        telemetry.record('EVENT_DROPPED', undefined, { reason: 'late' });
        if (current?.sessionId === data.sessionId && current.subscriptionId === data.subscriptionId) emit(current, { kind: 'sync.recover' });
        return false;
      }
      if (data.kind === 'sync.recover') return true;
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
      const overridden = current?.sessionId === data.sessionId && current.subscriptionId === data.subscriptionId && data.kind !== 'clock';
      if (overridden) telemetry.mark('EVENT_DROPPED', parseBeatTraces(data.telemetry), { reason: 'native-override' });
      return !overridden;
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
      current.retryAt = 0;
      halt(current, typeof event.reason === 'string' ? event.reason : 'capture-failed');
    },
  };
}
