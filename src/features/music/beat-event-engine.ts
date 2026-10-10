import type { BeatEvent, MusicClock } from './mediaBridge';
import { createBeatScheduler } from './beat-scheduler';
import { CHUNK_SECONDS, type MediaAsset, type TrackChunk, type TrackManifest, type EventRow } from './event-track';
import { createEventTrackClient, EventTrackServiceError, InvalidEventTrack, type EventTrackClient } from './event-track-client';
import type { BeatCapabilities } from './beat-capabilities';
import { playbackRange, type PlaybackRange } from './event-track-ranges';
import { clockAdvancing, clockDiscontinuity, parsePlaybackClock, parsePlaybackTiming, playbackPosition } from '../../../extensions/kanban-music/beat-timing.js';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { PlaybackAudioSegment } from './playback-audio-segment';
import type { LeadAvailability } from './lead-feature';

export type BeatEventPath = 'cache' | 'local' | 'degraded';
export interface BeatEventOptions { asset?: MediaAsset; duration?: number; capabilities: BeatCapabilities; initialClock?: MusicClock; demand?: boolean; capturedInput?: boolean; onLeadAvailability?: (state: LeadAvailability) => void }
const telemetry = beatTelemetry.at('beat-event-engine');
const tolerance = .04;
interface Candidate { row: EventRow; time: number; rank: number; key: string }
type ScheduledEvent = Extract<BeatEvent, { kind: 'onset' | 'melody.state' | 'tempo.state' | 'tempo.tick' }>;

// Per playback owner: bounded chunks, requests, semantic merge and scheduling.
// Local capture stays alive during cache waits and supplies recovery signals.
export function createBeatEventEngine(options: BeatEventOptions, emit: (event: BeatEvent) => void, recover: () => void,
  clientFactory = createEventTrackClient) {
  options = { ...options };
  const lifetime = new AbortController();
  let range = new AbortController();
  const client: EventTrackClient | undefined = options.asset && clientFactory(options.asset, lifetime.signal, options.duration);
  let clock: MusicClock | undefined, manifest: TrackManifest | undefined;
  let stopped = false, epoch = 0, captureId = crypto.randomUUID(), sequence = 0, melody = 0;
  let localCapture: string | undefined, localLive = false, muted = false, silent = false, localReason: string | undefined;
  let localSequence = 0, localAt = 0, announcedAt = 0, stale = false;
  const retired = new Set<string>();
  let path: BeatEventPath = 'degraded', announced: BeatEventPath | undefined;
  let manifestBusy = false, nextLookup = 0, nextDemand = 0, demandBusy = false, demandLive = false, serial = 0, lastTick = -1;
  let demandId = crypto.randomUUID(), demandRange: PlaybackRange | undefined;
  let demandRequest: Promise<unknown> | undefined;
  let uploadBusy = false;
  const releaseDemand = () => {
    const identity = demandId, request = demandRequest;
    demandId = crypto.randomUUID(); demandRange = undefined; nextDemand = 0;
    if (!demandLive) return;
    demandLive = false;
    // End after an in-flight admission so its response cannot recreate the
    // released lease. A resumed session gets a different demand identity.
    void Promise.resolve(request).catch(() => {}).then(() => client?.endDemand?.(identity)).catch(() => {});
  };
  const chunks = new Map<number, TrackChunk>(), inFlight = new Map<number, number>(), retry = new Map<number, number>();
  const pending = new Map<string, Candidate>(), delivered: Candidate[] = [];
  const sent = new Map<number, Set<string>>();
  // Availability is observation only: it never inserts, removes or schedules events.
  let analysis: LeadAvailability = 'checking', reported: LeadAvailability | undefined;
  const reportAvailability = () => {
    if (stopped || !options.demand) return;
    const current = clock && chunks.get(Math.floor(playbackPosition(clock) / CHUNK_SECONDS));
    const state = current ? current.events.some(event => event.row === 'melody') ? 'ready' : 'empty' : client ? analysis : 'unavailable';
    if (state !== reported) { reported = state; options.onLeadAvailability?.(state); }
  };
  const scheduler = createBeatScheduler(event => {
    if (stopped || !clock || !clockAdvancing(clock)) return;
    if (event.kind === 'clock' || event.kind === 'sync.state' || event.kind === 'sync.recover') return;
    if (event.semanticKey) {
      const candidate = pending.get(event.semanticKey); pending.delete(event.semanticKey);
      if (candidate) { delivered.push(candidate); if (delivered.length > 2048) delivered.shift(); }
    }
    emit({ ...event, captureId, ...(event.kind === 'onset' ? { sequence: ++sequence } : {}),
      ...(event.kind === 'melody.state' ? { melody: { ...event.melody, note: event.melody.active ? ++melody : melody } } : {}) });
  }, recover);
  const coverage = (time: number) => chunks.has(Math.floor(time / CHUNK_SECONDS));
  const active = () => clock && clockAdvancing(clock) && Date.now() - clock.sampledAt <= 3500 && !muted
    && (!silent || coverage(playbackPosition(clock)));
  const announce = () => {
    const next: BeatEventPath = clock && coverage(playbackPosition(clock)) ? 'cache'
      : localLive && options.capabilities.tier !== 'clock-only' ? 'local' : 'degraded';
    path = next;
    if (!active() && !(!clock && next === 'local')) return;
    if (announced !== next) {
      scheduler.cancelSource('degraded');
      announced = next;
      announcedAt = Date.now();
      emit({ kind: 'sync.state', mode: 'capture', captureId, reason: next === 'degraded' ? localReason || next : next, eventPath: next });
      telemetry.record('EVENT_PATH', undefined, { eventSource: next });
      if (next === 'degraded') emit({ kind: 'tempo.state', captureId, tempo: { locked: true, bpm: 120, confidence: 0 } });
      else emit({ kind: 'tempo.state', captureId, tempo: { locked: false, bpm: null, confidence: 0 } });
    } else if (Date.now() - announcedAt >= 2000) {
      announcedAt = Date.now();
      emit({ kind: 'sync.state', mode: 'capture', captureId, reason: next, eventPath: next });
    }
  };
  const clear = () => {
    releaseDemand();
    epoch++; captureId = crypto.randomUUID(); sequence = melody = 0; announced = undefined; lastTick = -1;
    scheduler.reset('schedule-reset', true); pending.clear(); delivered.length = 0; sent.clear();
    // Old fetch completions cannot insert or schedule data after a seek.
    range.abort(); range = new AbortController(); inFlight.clear(); retry.clear();
    nextLookup = nextDemand = 0;
    analysis = 'checking'; reportAvailability();
  };
  const add = (event: ScheduledEvent, row: EventRow, time: number, rank: number) => {
    if (delivered.some(item => item.row === row && Math.abs(item.time - time) <= tolerance)) {
      telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'semantic-duplicate' }); return;
    }
    const previous = [...pending.values()].find(item => item.row === row && Math.abs(item.time - time) <= tolerance);
    if (previous) {
      if (previous.rank >= rank) { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'semantic-duplicate' }); return; }
      scheduler.cancelSemantic(previous.key); pending.delete(previous.key);
      telemetry.mark('EVENT_REPLACED', event.telemetry, { reason: 'priority' });
    }
    if (pending.size >= 2048) {
      const oldest = pending.keys().next().value!; scheduler.cancelSemantic(oldest); pending.delete(oldest);
    }
    const key = `event:${++serial}`; pending.set(key, { row, time, rank, key });
    scheduler.enqueue({ ...event, semanticKey: key, captureId });
  };
  const loadChunk = (index: number) => {
    if (!manifest || !client || chunks.has(index) || inFlight.has(index) || inFlight.size >= 2
      || index < 0 || index * CHUNK_SECONDS >= manifest.duration || Date.now() < (retry.get(index) || 0)) return;
    const owner = epoch, revision = manifest.revision; inFlight.set(index, owner);
    void client.chunk(manifest, index, range.signal).then(chunk => {
      if (stopped || owner !== epoch || manifest?.revision !== revision) return;
      if (!chunk) { retry.set(index, Date.now() + 15000); return; }
      const lead = (value: TrackChunk | undefined) => value?.events.filter(e => e.row === 'melody') || [];
      const before = lead(chunks.get(index - 1)).at(-1), first = lead(chunk)[0];
      const last = lead(chunk).at(-1), after = lead(chunks.get(index + 1))[0];
      if (before && first && before.time + (before.duration || 0) > first.time
        || last && after && last.time + (last.duration || 0) > after.time) {
        retry.set(index, Date.now() + 15000); telemetry.record('CACHE_MISS', undefined, { reason: 'invalid' }); return;
      }
      const currentIndex = clock ? Math.floor(playbackPosition(clock) / CHUNK_SECONDS) : index;
      if (index < currentIndex - 1 || index > currentIndex + 1) return;
      chunks.set(index, chunk);
      telemetry.record('CACHE_HIT', undefined, { queueDepth: chunks.size });
      for (const item of pending.values()) if (item.rank < 3 && Math.floor(item.time / CHUNK_SECONDS) === index) {
        scheduler.cancelSemantic(item.key); pending.delete(item.key);
        telemetry.record('EVENT_REPLACED', undefined, { reason: 'priority' });
      }
      announce(); pump();
    }).catch(error => { if (!stopped && owner === epoch) {
      if (error instanceof InvalidEventTrack) {
        manifest = undefined; chunks.clear(); clear(); nextLookup = Date.now() + 15000; announce();
      } else retry.set(index, error instanceof EventTrackServiceError && error.permanent ? Infinity : Date.now() + 15000);
      telemetry.record('CACHE_MISS', undefined, { reason: error instanceof InvalidEventTrack ? 'invalid' : 'transport' });
      analysis = error instanceof EventTrackServiceError ? error.permanent ? 'blocked' : 'unavailable' : 'failed'; reportAvailability();
    } })
      .finally(() => { if (inFlight.get(index) === owner) inFlight.delete(index); });
  };
  const lookup = () => {
    if (!options.demand || !client || !clock || manifestBusy || Date.now() < nextLookup) return;
    const view = playbackRange(playbackPosition(clock), options.duration || manifest?.duration || 0);
    if (!view) return;
    const owner = epoch;
    manifestBusy = true; nextLookup = Date.now() + 15000;
    void client.manifest(view).then(value => {
      if (stopped || owner !== epoch) return;
      if (value && manifest && manifest.revision !== value.revision) { chunks.clear(); clear(); }
      manifest = value;
      telemetry.record(value ? 'CACHE_HIT' : 'CACHE_MISS');
      const status = client.analysisStatus?.();
      if (status) telemetry.record('ANALYSIS_REQUESTED', undefined, { reason: status });
      if (status === 'failed') analysis = 'failed';
      else if (status === 'input_unavailable' || status === 'cancelled') analysis = 'unavailable';
      else if (status === 'pending' || status === 'queued' || status === 'running') analysis = 'pending';
      pump();
    }).catch(error => { if (!stopped && owner === epoch) {
      telemetry.record('CACHE_MISS', undefined, { reason: 'transport' });
      analysis = error instanceof EventTrackServiceError ? error.permanent ? 'blocked' : 'unavailable' : 'failed';
      if (analysis === 'blocked') nextLookup = nextDemand = Infinity;
      reportAvailability();
    } })
      .finally(() => { manifestBusy = false; });
  };
  const demand = () => {
    const wanted = Boolean(options.demand && clock && clockAdvancing(clock) && Date.now() - clock.sampledAt <= 3500 && !muted);
    if (!wanted) {
      if (demandLive) releaseDemand();
      return;
    }
    if (!client || !clock || demandBusy || Date.now() < nextDemand) return;
    const position = playbackPosition(clock);
    const view = demandRange && position >= demandRange.start && position < demandRange.end - 60
      ? demandRange : playbackRange(position, options.duration || manifest?.duration || 0);
    if (!view) return;
    demandRange = view;
    demandBusy = demandLive = true; nextDemand = Date.now() + 15000;
    const owner = epoch, identity = demandId;
    demandRequest = client.requestAnalysis(view, demandId, options.capturedInput).then(status => {
      if (!stopped && owner === epoch && identity === demandId && analysis !== 'blocked') {
        telemetry.record('ANALYSIS_REQUESTED', undefined, { reason: status === 'pending' ? 'starting' : 'failed' });
        analysis = status; reportAvailability();
      }
    }).catch(error => { if (!stopped && owner === epoch && identity === demandId) {
      telemetry.record('ANALYSIS_REQUESTED', undefined, { reason: 'transport' });
      analysis = error instanceof EventTrackServiceError && error.permanent ? 'blocked' : 'failed';
      if (analysis === 'blocked') nextDemand = Infinity;
      reportAvailability();
    } })
      .finally(() => { demandBusy = false; });
  };
  function pump() {
    if (stopped) return;
    demand(); lookup(); if (!clock) return;
    if (localLive && Date.now() - localAt > 3500) {
      localLive = false; scheduler.cancelSource('local');
      for (const [key, item] of pending) if (item.rank === 2) pending.delete(key);
    }
    if (Date.now() - clock.sampledAt > 3500) {
      if (!stale) { stale = true; clear(); emit({ kind: 'sync.state', mode: 'clock', reason: 'clock-stale' }); recover(); }
      return;
    }
    stale = false;
    const position = playbackPosition(clock), index = Math.floor(position / CHUNK_SECONDS);
    // Only the current and next chunk are fetched; a third may bridge a boundary.
    for (const key of chunks.keys()) if (key < index - 1 || key > index + 1) { chunks.delete(key); sent.delete(key); }
    for (const key of retry.keys()) if (key < index || key > index + 1) retry.delete(key);
    for (const [key, item] of pending) if (item.time < position - 1) pending.delete(key);
    while (delivered[0]?.time < position - 1) delivered.shift();
    if (options.demand) { loadChunk(index); loadChunk(index + 1); }
    reportAvailability();
    announce();
    if (!active()) return;
    const horizon = position + Math.min(30, clock.playbackRate * 4);
    for (const chunk of chunks.values()) for (const note of chunk.events) {
      const sentEvents = sent.get(chunk.index) || new Set<string>();
      sent.set(chunk.index, sentEvents);
      if (note.time < position - .05 || note.time > horizon || sentEvents.has(note.id)) continue;
      sentEvents.add(note.id);
      const traces = telemetry.events('onset', [note.row === 'melody' ? 'melodic' : note.row], { confidence: note.confidence })
        ?.map(trace => ({ ...trace, eventId: note.id, origin: 'event-track-cache' as const, captureId,
          targetPlaybackTime: note.time, targetTime: clock!.sampledAt + (note.time - clock!.currentTime) / clock!.playbackRate * 1000, eventSource: 'cache' as const }));
      telemetry.mark('EVENT_DETECTED', traces);
      if (note.lead) telemetry.mark('LEAD_EVENT', traces, { ...note.lead, targetPlaybackTime:note.time, eventId:note.id });
      const event: ScheduledEvent = note.row === 'melody'
        ? { kind: 'melody.state', captureId, melody: { active: true, level: note.confidence, note: 0 }, ...(note.lead ? {lead:note.lead} : {}) }
        : { kind: 'onset', bands: [note.row === 'snare' ? 'clap' : note.row], duration: note.duration };
      add({ ...event, targetPlaybackTime: note.time, playbackClock: clock, telemetry: traces, eventSource: 'cache' }, note.row, note.time, 3);
    }
    if (path === 'degraded') {
      const tick = Math.floor(position * 4);
      if (tick !== lastTick) {
        lastTick = tick;
        const target = position + .03;
        const trace = telemetry.events('tempo', ['generic'])?.map(t => ({ ...t, targetPlaybackTime: target,
          targetTime: clock!.sampledAt + (target - clock!.currentTime) / clock!.playbackRate * 1000, eventSource: 'degraded' as const }));
        telemetry.mark('EVENT_DETECTED', trace);
        scheduler.enqueue({ kind: 'tempo.tick', captureId, tick: { step: tick % 8, phase: 0, beatPosition: tick / 2, subdivision: 2 },
          targetPlaybackTime: target, playbackClock: clock, telemetry: trace, eventSource: 'degraded' });
      }
    }
  }
  const timer = setInterval(pump, 100);
  return {
    setDemand(value: boolean) {
      if (stopped || options.demand === value) return;
      options.demand = value;
      pump();
    },
    needsCapturedAudio() {
      return Boolean(!stopped && options.demand && options.capturedInput && demandLive
        && !uploadBusy && clock && active() && !coverage(playbackPosition(clock)));
    },
    captureSegment(segment: PlaybackAudioSegment) {
      if (stopped || !options.demand || !options.capturedInput || !demandLive || !clock || !active()
        || uploadBusy || !client?.uploadSegment || segment.end > (options.duration || 0)) return;
      const owner = epoch, identity = demandId;
      uploadBusy = true;
      void client.uploadSegment(segment, identity).then(uploaded => {
        if (stopped || owner !== epoch) return;
        telemetry.record('ANALYSIS_REQUESTED', undefined, { reason: uploaded ? 'captured-input' : 'input-unavailable' });
        if (uploaded) { nextLookup = 0; lookup(); }
      }).catch(() => { if (!stopped && owner === epoch) telemetry.record('ANALYSIS_REQUESTED', undefined, { reason: 'input-unavailable' }); })
        .finally(() => { uploadBusy = false; });
    },
    accept(event: BeatEvent) {
      if (stopped) return;
      if (event.kind === 'clock') {
        if (!parsePlaybackClock(event.clock) || event.clock.sampledAt > Date.now() + 8000
          || clock && event.clock.sampledAt < clock.sampledAt) {
          telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'invalid' }); return;
        }
        if (clockDiscontinuity(clock, event.clock) || (!clock || clockAdvancing(clock)) && !clockAdvancing(event.clock)) clear();
        clock = event.clock; scheduler.clock(clock); emit(event); pump(); return;
      }
      if (event.kind === 'sync.state') {
        if (event.captureId && retired.has(event.captureId)) { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return; }
        const wasMuted = muted, wasSilent = silent;
        if (localCapture !== event.captureId || event.mode !== 'capture') {
          if (localCapture) retired.add(localCapture);
          if (retired.size > 16) retired.delete(retired.values().next().value!);
          localSequence = 0; scheduler.cancelSource('local');
          for (const [key, item] of pending) if (item.rank === 2) pending.delete(key);
        }
        localAt = Date.now(); localLive = event.mode === 'capture'; localCapture = event.captureId;
        muted = event.reason === 'muted'; silent = event.reason === 'silent'; localReason = event.reason;
        if (muted && !wasMuted || silent && !wasSilent && !coverage(clock ? playbackPosition(clock) : 0)) clear();
        if (!active() && !localLive) { announced = undefined; emit({ ...event, captureId }); }
        announce(); return;
      }
      if (event.kind === 'sync.recover') {
        if (path !== 'cache') { scheduler.reset('schedule-reset'); pending.clear(); }
        recover(); return;
      }
      if (!localLive || options.capabilities.tier === 'clock-only' || event.captureId !== localCapture || clock && !active()) {
        telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return;
      }
      if (event.kind === 'onset') {
        if (event.sequence !== undefined && event.sequence <= localSequence) { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'sequence' }); return; }
        if (event.sequence !== undefined) localSequence = event.sequence;
      }
      localAt = Date.now();
      if (event.kind === 'melody.state' && !event.melody.active && event.melody.note === 0) {
        for (const [key, item] of pending) if (item.rank === 2 && item.row === 'melody') {
          scheduler.cancelSemantic(key); pending.delete(key);
        }
      }
      const parsedTiming = parsePlaybackTiming(event);
      if (!parsedTiming && (event.targetPlaybackTime !== undefined || event.playbackClock !== undefined)) {
        telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'invalid' }); return;
      }
      // Untimed legacy detections and envelope updates retain the original
      // arrival path. Do not invent a media clock to schedule them.
      if (!parsedTiming && (!clock || event.kind === 'melody.state' && !event.melody.active)) {
        if (path === 'local' || clock && event.kind === 'melody.state' && !coverage(playbackPosition(clock))) {
          emit({ ...event, captureId, eventSource: 'local',
            ...(event.kind === 'onset' ? { sequence: ++sequence } : {}),
            ...(event.kind === 'melody.state' ? { melody: { ...event.melody, note: event.melody.active ? ++melody : melody } } : {}) });
        }
        return;
      }
      if (!clock) return;
      const timing = parsedTiming || { targetPlaybackTime: playbackPosition(clock), playbackClock: clock };
      if (event.kind === 'onset' || event.kind === 'melody.state' && event.melody.active) {
        const rows: EventRow[] = event.kind === 'onset' ? event.bands.map(b => b === 'clap' ? 'snare' : b) : ['melody'];
        for (const row of rows) {
          if (coverage(timing.targetPlaybackTime)) {
            telemetry.mark('EVENT_DROPPED', event.telemetry?.filter(t => t.type === (row === 'melody' ? 'melodic' : row)), { reason: 'priority' }); continue;
          }
          const split: ScheduledEvent = event.kind === 'onset' ? { ...event, bands: [row === 'snare' ? 'clap' : row] } : event;
          const observed = event.telemetry?.length ? event.telemetry.filter(t => t.type === (row === 'melody' ? 'melodic' : row))
            : telemetry.events('onset', [row], { origin: 'local-detector' });
          const traces = observed?.map(t => ({ ...t,
            captureId, targetPlaybackTime: timing.targetPlaybackTime, origin: t.origin || 'local-detector' as const, eventSource: 'local' as const }));
          // Older capture realms may have diagnostics disabled. This trace
          // begins at receipt of their real typed event, never at a detector.
          if (!event.telemetry?.length) telemetry.mark('EVENT_RECEIVED', traces);
          add({ ...split, ...timing, telemetry: traces, eventSource: 'local' }, row, timing.targetPlaybackTime, 2);
        }
      } else if (path !== 'degraded' && !(event.kind === 'melody.state' && coverage(timing.targetPlaybackTime))) {
        scheduler.enqueue({ ...event, ...timing, captureId, eventSource: 'local' });
      }
    },
    stop() { stopped = true; releaseDemand();
      clearInterval(timer); lifetime.abort(); range.abort(); scheduler.reset('stopped', true); chunks.clear(); inFlight.clear(); retry.clear(); pending.clear(); delivered.length = 0; sent.clear(); },
    stats() { return { path, chunks: chunks.size, requests: inFlight.size, pending: pending.size, delivered: delivered.length, manifest: Boolean(manifest) }; },
  };
}
