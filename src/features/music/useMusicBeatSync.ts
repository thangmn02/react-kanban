import { useEffect, useRef, useState } from 'react';
import { sendBeatRequest, subscribeBeatEvents, type BeatBand, type BeatEvent, type MusicClock, type MelodyState } from './mediaBridge';
import { beatTelemetry, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import { createBeatScheduler } from './beat-scheduler';
import { clockAdvancing } from '../../../extensions/kanban-music/beat-timing.js';
import { createBeatEventEngine, type BeatEventOptions, type BeatEventPath } from './beat-event-engine';
const telemetry = beatTelemetry.at('beat-controller');

export interface MusicBeatState {
  sessionId: string;
  mode: 'clock' | 'capture';
  onsets: Partial<Record<BeatBand, number>>;
  rates?: Partial<Record<BeatBand, number>>;
  tempo?: { locked: boolean; bpm: number | null; confidence: number };
  tickCount?: number;
  reason?: string;
  captureId?: string;
  melody?: MelodyState;
  eventPath?: BeatEventPath;
  telemetry?: Record<string, BeatTrace>;
}

export function useMusicBeatSync(sessionId: string | undefined, onClock: (sessionId: string, clock: MusicClock) => void, eventOptions?: BeatEventOptions): MusicBeatState {
  const [state, setState] = useState<MusicBeatState>({ sessionId: '', mode: 'clock', onsets: {} });
  const committed = useRef(new Set<string>());
  useEffect(() => {
    if (!beatTelemetry.enabled) return;
    const current = new Set<string>();
    for (const trace of Object.values(state.telemetry || {})) {
      current.add(trace.id);
      if (!committed.current.has(trace.id)) telemetry.record('EVENT_STATE_COMMITTED', trace);
    }
    committed.current = current;
  }, [state.telemetry]);
  useEffect(() => {
    if (!sessionId) return;
    const selectedSessionId = sessionId;
    const subscriptionId = crypto.randomUUID();
    let cancelled = false;
    let renewing = false;
    let lastLiveState = Date.now();
    let sequence = 0;
    let captureId: string | undefined;
    let liveMode: 'clock' | 'capture' = 'clock';
    let melodySequence = -1;
    let melodyLease: ReturnType<typeof setTimeout> | undefined;
    const recent: Record<BeatBand, number[]> = { kick: [], clap: [], hat: [], bass: [], melody: [] };
    const lastAccepted: Record<BeatBand, number> = { kick: -Infinity, clap: -Infinity, hat: -Infinity, bass: -Infinity, melody: -Infinity };
    const clearRates = () => { (Object.keys(recent) as BeatBand[]).forEach((band) => { recent[band] = []; lastAccepted[band] = -Infinity; }); };
    const rates = (now: number) => {
      const result: Partial<Record<BeatBand, number>> = {};
      (Object.keys(recent) as BeatBand[]).forEach((band) => {
        recent[band] = recent[band].filter((time) => time > now - 2000);
        result[band] = recent[band].length / 2;
      });
      return result;
    };
    const retired = new Set<string>();
    const retireCapture = () => {
      if (captureId) retired.add(captureId);
      if (retired.size > 16) retired.delete(retired.values().next().value!);
    };
    const scheduler = createBeatScheduler(receive, () => { void renew(); });
    function receive(event: BeatEvent) {
      const drop = (reason: string) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason });
      const accepted = (bands?: BeatBand[]) => telemetry.mark('EVENT_ACCEPTED', event.telemetry?.filter((t) => !bands || bands.some((b) => (b === 'clap' ? 'snare' : b === 'melody' ? 'melodic' : b) === t.type)));
      const diagnostic = (current: MusicBeatState, bands?: BeatBand[]) => {
        if (!event.telemetry?.length) return {};
        const traces = { ...current.telemetry };
        event.telemetry.filter((t) => !bands || bands.some((b) => (b === 'clap' ? 'snare' : b === 'melody' ? 'melodic' : b) === t.type))
          .forEach((t) => {
            const key = `${t.source}:${t.type}`, previous = traces[key];
            if (previous && previous.id !== t.id && !committed.current.has(previous.id)) {
              telemetry.record('EVENT_DROPPED', previous, { reason: 'renderer-coalesced' });
            }
            traces[key] = t;
          });
        return { telemetry: traces };
      };
      if (cancelled) { drop('owner'); return; }
      if (event.kind === 'sync.recover') { void renew(); return; }
      if (event.kind === 'clock') {
        const discontinuity = scheduler.clock(event.clock);
        onClock(selectedSessionId, event.clock);
        if (!clockAdvancing(event.clock) || discontinuity) {
          retireCapture();
          liveMode = 'clock';
          clearRates();
          clearTimeout(melodyLease);
          setState({ sessionId: selectedSessionId, mode: 'clock', reason: discontinuity ? 'track-changed' : 'not-playing', onsets: {} });
        }
        return;
      }
      if (event.kind === 'tempo.state') {
        if (liveMode !== 'capture' || event.captureId !== captureId) { drop('owner'); return; }
        accepted();
        lastLiveState = Date.now();
        setState((current) => current.sessionId === sessionId && current.mode === 'capture'
          && current.captureId === event.captureId ? { ...current, tempo: event.tempo, ...diagnostic(current) } : current);
        return;
      }
      if (event.kind === 'tempo.tick') {
        if (liveMode !== 'capture' || event.captureId !== captureId) { drop('owner'); return; }
        lastLiveState = Date.now();
        let observed = false;
        setState((current) => {
          if (current.sessionId !== sessionId || current.mode !== 'capture'
            || current.captureId !== event.captureId || !current.tempo?.locked) {
            if (!observed) { observed = true; drop('owner'); }
            return current;
          }
          if (!observed) { observed = true; accepted(); }
          return { ...current, tickCount: (current.tickCount || 0) + 1, ...diagnostic(current) };
        });
        return;
      }
      if (event.kind === 'melody.state') {
        if (liveMode !== 'capture' || event.captureId !== captureId || event.melody.note < melodySequence) { drop(event.melody.note < melodySequence ? 'sequence' : 'owner'); return; }
        accepted();
        melodySequence = event.melody.note;
        lastLiveState = Date.now();
        clearTimeout(melodyLease);
        setState((current) => current.sessionId === sessionId && current.mode === 'capture' && current.captureId === event.captureId
          ? { ...current, melody: event.melody, rates: rates(Date.now()), ...diagnostic(current) } : current);
        // A dead/stalled feed must never leave a held note behind.
        melodyLease = setTimeout(() => { telemetry.record('LEASE_EXPIRED', undefined, { captureId }); setState((current) => ({ ...current, melody: undefined })); }, 700);
        return;
      }
      let acceptedBands: BeatBand[] = [];
      if (event.kind === 'onset') {
        if (liveMode !== 'capture' || (captureId && event.captureId !== captureId)
          || (captureId && (!event.sequence || event.sequence <= sequence))) { drop(liveMode !== 'capture' || event.captureId !== captureId ? 'owner' : 'sequence'); return; }
        sequence = event.sequence ?? sequence + 1;
        const now = Date.now();
        acceptedBands = event.bands.filter((band) => {
          if (now - lastAccepted[band] < 120) {
            telemetry.mark('EVENT_DROPPED', event.telemetry?.filter((t) => t.type === (band === 'clap' ? 'snare' : band === 'melody' ? 'melodic' : band)), { reason: 'debounce' }); return false;
          }
          lastAccepted[band] = now;
          recent[band].push(now);
          return true;
        });
        if (!acceptedBands.length) return;
        accepted(acceptedBands);
      } else {
        if (captureId !== event.captureId || liveMode !== event.mode) {
          sequence = 0; melodySequence = -1; clearRates(); clearTimeout(melodyLease);
        }
        captureId = event.captureId;
        liveMode = event.mode;
      }
      // Clock messages alone cannot keep a dead capture looking live.
      lastLiveState = Date.now();
      setState((previous) => {
        const current: MusicBeatState = previous.sessionId === selectedSessionId ? previous : { sessionId: selectedSessionId, mode: 'clock', onsets: {} };
        if (event.kind === 'sync.state') return {
          ...current, mode: event.mode, reason: event.reason, captureId: event.captureId,
          eventPath: event.eventPath,
          onsets: current.mode === event.mode && current.captureId === event.captureId ? current.onsets : {},
          rates: event.mode === 'capture' ? rates(Date.now()) : {},
          tempo: current.mode === event.mode && current.captureId === event.captureId ? current.tempo : undefined,
          tickCount: current.mode === event.mode && current.captureId === event.captureId ? current.tickCount : 0,
          melody: current.mode === event.mode && current.captureId === event.captureId ? current.melody : undefined,
          ...(current.telemetry ? { telemetry: current.mode === event.mode && current.captureId === event.captureId ? current.telemetry : undefined } : {}),
        };
        if (current.mode !== 'capture') return current;
        const onsets = { ...current.onsets };
        acceptedBands.forEach((band) => { onsets[band] = (onsets[band] || 0) + 1; });
        // Rejected row traces must not replace the last accepted row's origin.
        const acceptedTraces = diagnostic(current, acceptedBands);
        return { ...current, onsets, rates: rates(Date.now()), ...acceptedTraces };
      });
    }
    const engine = eventOptions && createBeatEventEngine(eventOptions, receive, () => { void renew(); });
    if (engine && eventOptions?.initialClock) engine.accept({ kind: 'clock', clock: eventOptions.initialClock });
    const unsubscribe = subscribeBeatEvents(sessionId, subscriptionId, (event) => {
      if (engine) { engine.accept(event); return; }
      if (event.kind === 'clock') { receive(event); return; }
      if (event.kind === 'sync.state') {
        if (event.mode === 'capture' && event.captureId && retired.has(event.captureId)) {
          telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return;
        }
        if (event.captureId !== captureId || event.mode !== liveMode) {
          retireCapture(); scheduler.reset('schedule-reset', true);
        }
        receive(event); return;
      }
      if (event.kind === 'sync.recover') { scheduler.reset('schedule-reset'); receive(event); return; }
      if (liveMode !== 'capture' || event.captureId !== captureId) {
        telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return;
      }
      lastLiveState = Date.now();
      if (event.kind === 'melody.state' && event.melody.note === 0 && !event.melody.active && event.targetPlaybackTime === undefined) {
        // Model disable/restart cancels its pending notes, never the drum rows.
        scheduler.cancelKind('melody.state');
      }
      scheduler.enqueue(event);
    });
    async function renew() {
      if (renewing || cancelled) return;
      renewing = true;
      try {
        await sendBeatRequest('dock.beat.sync.start', selectedSessionId, subscriptionId);
        telemetry.record('LEASE_RENEW', undefined, { captureId });
      }
      catch { telemetry.record('LEASE_EXPIRED', undefined, { captureId, reason: 'transport' }); /* The watchdog removes stale capture state. */ }
      finally { renewing = false; }
    }
    const stop = () => {
      cancelled = true;
      scheduler.reset('stopped', true);
      engine?.stop();
      clearTimeout(melodyLease);
      clearInterval(interval);
      clearInterval(watchdog);
      void sendBeatRequest('dock.beat.sync.stop', sessionId, subscriptionId).catch(() => {});
    };
    const interval = setInterval(() => { void renew(); }, 2000);
    const watchdog = setInterval(() => {
      if (Date.now() - lastLiveState <= 3500) return;
      telemetry.record('LEASE_EXPIRED', undefined, { captureId, reason: 'sync-stale' });
      scheduler.reset('sync-stale', true);
      liveMode = 'clock';
      clearRates();
      setState((current) => current.mode === 'clock' && current.reason === 'sync-stale' ? current
        : { sessionId, mode: 'clock', reason: 'sync-stale', onsets: {} });
      void renew();
    }, 500);
    window.addEventListener('pagehide', stop);
    void renew();
    return () => { unsubscribe(); window.removeEventListener('pagehide', stop); stop(); };
  }, [sessionId, onClock, eventOptions]);
  return state.sessionId === sessionId ? state : { sessionId: sessionId || '', mode: 'clock', onsets: {} };
}
