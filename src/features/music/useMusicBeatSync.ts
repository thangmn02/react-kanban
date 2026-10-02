import { useEffect, useState } from 'react';
import { sendBeatRequest, subscribeBeatEvents, type BeatBand, type MusicClock } from './mediaBridge';

export interface MusicBeatState {
  sessionId: string;
  mode: 'clock' | 'capture';
  onsets: Partial<Record<BeatBand, number>>;
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
    const unsubscribe = subscribeBeatEvents(sessionId, subscriptionId, (event) => {
      if (cancelled) return;
      if (event.kind === 'clock') {
        onClock(sessionId, event.clock);
        if (!event.clock.playing) {
          liveMode = 'clock';
          setState({ sessionId, mode: 'clock', reason: 'not-playing', onsets: {} });
        }
        return;
      }
      if (event.kind === 'onset') {
        if (liveMode !== 'capture' || (captureId && event.captureId !== captureId)
          || (captureId && (!event.sequence || event.sequence <= sequence))) return;
        sequence = event.sequence ?? sequence + 1;
      } else {
        if (captureId !== event.captureId || liveMode !== event.mode) sequence = 0;
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
        };
        if (current.mode !== 'capture') return current;
        const onsets = { ...current.onsets };
        event.bands.forEach((band) => { onsets[band] = (onsets[band] || 0) + 1; });
        return { ...current, onsets };
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
      setState((current) => current.mode === 'clock' && current.reason === 'sync-stale' ? current
        : { sessionId, mode: 'clock', reason: 'sync-stale', onsets: {} });
    }, 500);
    window.addEventListener('pagehide', stop);
    void renew();
    return () => { unsubscribe(); window.removeEventListener('pagehide', stop); stop(); };
  }, [sessionId, onClock]);
  return state.sessionId === sessionId ? state : { sessionId: sessionId || '', mode: 'clock', onsets: {} };
}
