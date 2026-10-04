import { useEffect, useState } from 'react';
import { sendBeatRequest, subscribeBeatEvents, type BeatBand, type MusicClock } from './mediaBridge';

export interface MusicBeatState {
  sessionId: string;
  mode: 'clock' | 'capture';
  onsets: Partial<Record<BeatBand, number>>;
  rates?: Partial<Record<BeatBand, number>>;
  tempo?: { locked: boolean; bpm: number | null; confidence: number };
  ticks?: Partial<Record<BeatBand, number>>;
  reason?: string;
  captureId?: string;
}

export function useMusicBeatSync(sessionId: string | undefined, onClock: (sessionId: string, clock: MusicClock) => void): MusicBeatState {
  const [state, setState] = useState<MusicBeatState>({ sessionId: '', mode: 'clock', onsets: {} });
  useEffect(() => {
    if (!sessionId) return;
    const subscriptionId = crypto.randomUUID();
    let cancelled = false;
    let renewing = false;
    let lastLiveState = Date.now();
    let sequence = 0;
    let captureId: string | undefined;
    let liveMode: 'clock' | 'capture' = 'clock';
    const recent: Record<BeatBand, number[]> = { kick: [], bass: [], snare: [], hat: [] };
    const lastAccepted: Record<BeatBand, number> = { kick: -Infinity, bass: -Infinity, snare: -Infinity, hat: -Infinity };
    const clearRates = () => { (Object.keys(recent) as BeatBand[]).forEach((band) => { recent[band] = []; lastAccepted[band] = -Infinity; }); };
    const rates = (now: number) => {
      const result: Partial<Record<BeatBand, number>> = {};
      (Object.keys(recent) as BeatBand[]).forEach((band) => {
        recent[band] = recent[band].filter((time) => time > now - 2000);
        result[band] = recent[band].length / 2;
      });
      return result;
    };
    const unsubscribe = subscribeBeatEvents(sessionId, subscriptionId, (event) => {
      if (cancelled) return;
      if (event.kind === 'clock') {
        onClock(sessionId, event.clock);
        if (!event.clock.playing) {
          liveMode = 'clock';
          clearRates();
          setState({ sessionId, mode: 'clock', reason: 'not-playing', onsets: {} });
        }
        return;
      }
      if (event.kind === 'tempo.state') {
        if (liveMode !== 'capture' || event.captureId !== captureId) return;
        lastLiveState = Date.now();
        setState((current) => current.sessionId === sessionId && current.mode === 'capture'
          && current.captureId === event.captureId ? { ...current, tempo: event.tempo } : current);
        return;
      }
      if (event.kind === 'tempo.tick') {
        if (liveMode !== 'capture' || event.captureId !== captureId) return;
        lastLiveState = Date.now();
        setState((current) => {
          if (current.sessionId !== sessionId || current.mode !== 'capture'
            || current.captureId !== event.captureId || !current.tempo?.locked) return current;
          const ticks = { ...current.ticks };
          event.tick.bands.forEach((band) => { ticks[band] = (ticks[band] || 0) + 1; });
          return { ...current, ticks };
        });
        return;
      }
      let acceptedBands: BeatBand[] = [];
      if (event.kind === 'onset') {
        if (liveMode !== 'capture' || (captureId && event.captureId !== captureId)
          || (captureId && (!event.sequence || event.sequence <= sequence))) return;
        sequence = event.sequence ?? sequence + 1;
        const now = Date.now();
        acceptedBands = event.bands.filter((band) => {
          if (now - lastAccepted[band] < 120) return false;
          lastAccepted[band] = now;
          recent[band].push(now);
          return true;
        });
        if (!acceptedBands.length) return;
      } else {
        if (captureId !== event.captureId || liveMode !== event.mode) { sequence = 0; clearRates(); }
        captureId = event.captureId;
        liveMode = event.mode;
      }
      // Clock messages alone cannot keep a dead capture looking live.
      lastLiveState = Date.now();
      setState((previous) => {
        const current = previous.sessionId === sessionId ? previous : { sessionId, mode: 'clock' as const, onsets: {} };
        if (event.kind === 'sync.state') return {
          ...current, mode: event.mode, reason: event.reason, captureId: event.captureId,
          onsets: current.mode === event.mode && current.captureId === event.captureId ? current.onsets : {},
          rates: event.mode === 'capture' ? rates(Date.now()) : {},
          tempo: current.mode === event.mode && current.captureId === event.captureId ? current.tempo : undefined,
          ticks: current.mode === event.mode && current.captureId === event.captureId ? current.ticks : {},
        };
        if (current.mode !== 'capture') return current;
        const onsets = { ...current.onsets };
        acceptedBands.forEach((band) => { onsets[band] = (onsets[band] || 0) + 1; });
        return { ...current, onsets, rates: rates(Date.now()) };
      });
    });
    const renew = async () => {
      if (renewing || cancelled) return;
      renewing = true;
      try { await sendBeatRequest('dock.beat.sync.start', sessionId, subscriptionId); }
      catch { /* Fail closed: the watchdog removes stale capture state. */ }
      finally { renewing = false; }
    };
    const stop = () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(watchdog);
      void sendBeatRequest('dock.beat.sync.stop', sessionId, subscriptionId).catch(() => {});
    };
    const interval = setInterval(() => { void renew(); }, 2000);
    const watchdog = setInterval(() => {
      if (Date.now() - lastLiveState <= 3500) return;
      liveMode = 'clock';
      clearRates();
      setState((current) => current.mode === 'clock' && current.reason === 'sync-stale' ? current
        : { sessionId, mode: 'clock', reason: 'sync-stale', onsets: {} });
    }, 500);
    window.addEventListener('pagehide', stop);
    void renew();
    return () => { unsubscribe(); window.removeEventListener('pagehide', stop); stop(); };
  }, [sessionId, onClock]);
  return state.sessionId === sessionId ? state : { sessionId: sessionId || '', mode: 'clock', onsets: {} };
}
