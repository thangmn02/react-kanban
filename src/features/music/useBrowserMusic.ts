import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { MusicBridgeError, sendMusicRequest, type BrowserMusicSession, type MusicClock } from './mediaBridge';
import { useMusicBeatSync } from './useMusicBeatSync';
import { mergeMusicSessions } from './mergeMusicSessions';
import { getBeatSource } from '../native/runtime';

// Keep discovery alive even while the music panel is hidden.
export function useBrowserMusic() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<BrowserMusicSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const lastSelectionToken = useRef('');

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await sendMusicRequest('sessions.get');
        if (!cancelled) {
          const clicked = next.find(item => item.selectionToken);
          if (clicked?.selectionToken && clicked.selectionToken !== lastSelectionToken.current) {
            const firstDiscovery = !lastSelectionToken.current;
            lastSelectionToken.current = clicked.selectionToken;
            // Session storage can remember an old paused toolbar selection.
            // On a fresh dock, prefer music actually playing over that stale
            // preference. New toolbar clicks and manual picker choices win.
            if (!firstDiscovery || !clicked.paused || !next.some(item => !item.paused && item.playing !== false)) setSelectedId(clicked.id);
          }
          setSessions((current) => mergeMusicSessions(current, next)); setConnected(true); setChecking(false); setError('');
        }
      } catch (reason) {
        if (!cancelled) { setSessions([]); setConnected(false); setChecking(false); setError(reason instanceof MusicBridgeError && reason.code === 'not-installed' ? '' : t('music.reconnect')); }
      } finally {
        if (!cancelled) timeout = setTimeout(poll, 2000);
      }
    };
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener('focus', reconnect);
    void poll();
    return () => { cancelled = true; clearTimeout(timeout); window.removeEventListener('focus', reconnect); };
  }, [attempt, t]);

  const selected = sessions.find((item) => item.id === selectedId) || sessions.find((item) => !item.paused) || sessions[0];
  const updateClock = useCallback((sessionId: string, clock: MusicClock) => {
    setSessions((current) => current.map((item) => item.id === sessionId && (item.sampledAt || 0) <= clock.sampledAt ? { ...item, ...clock } : item));
  }, []);
  const beat = useMusicBeatSync(selected?.id, updateClock);
  async function toggle() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const next = await sendMusicRequest(selected.paused ? 'media.play' : 'media.pause', selected.id);
      setSessions((current) => mergeMusicSessions(current, next)); setError('');
    }
    catch (reason) { setError(reason instanceof MusicBridgeError && reason.code === 'playback' ? t('music.pressPlayFirst') : t('music.failed')); }
    finally { setBusy(false); }
  }

  async function openMusicTab() {
    if (!selected || busy) return;
    setBusy(true);
    try { await sendMusicRequest('media.focus', selected.id); setError(''); }
    catch { setError(t('music.openTabFailed')); }
    finally { setBusy(false); }
  }

  const refresh = () => { setChecking(true); setAttempt((value) => value + 1); };
  return { sessions, selected, setSelectedId, connected, checking, error, busy, toggle, openMusicTab, refresh, beat,
    source: getBeatSource(connected),
    playing: Boolean(selected && !selected.paused && selected.playing !== false) };
}

export type BrowserMusicController = ReturnType<typeof useBrowserMusic>;
