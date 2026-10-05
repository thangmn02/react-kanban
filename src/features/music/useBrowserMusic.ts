import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { MusicBridgeError, sendMusicRequest, type BrowserMusicSession, type MusicClock } from './mediaBridge';
import { useMusicBeatSync } from './useMusicBeatSync';
import { mergeMusicSessions } from './mergeMusicSessions';
import { getBeatSource } from '../native/runtime';

interface MusicSelection {
  sessions: BrowserMusicSession[];
  selectedId: string;
  explicitSelection: boolean;
  selectionToken: string;
}
const isPlaying = (session: BrowserMusicSession | undefined) => Boolean(session && !session.paused && session.playing !== false);

function updateSelection(current: MusicSelection, next: BrowserMusicSession[], toolbar = false): MusicSelection {
  const sessions = mergeMusicSessions(current.sessions, next);
  const clicked = toolbar ? sessions.find(item => item.selectionToken) : undefined;
  const freshClick = clicked?.selectionToken && clicked.selectionToken !== current.selectionToken;
  const selectionToken = clicked?.selectionToken || current.selectionToken;
  // Ignore an old paused toolbar preference on first discovery. Subsequent
  // clicks select their source, even when paused, until playback changes.
  if (freshClick && (current.selectionToken || isPlaying(clicked) || !sessions.some(isPlaying))) {
    return { sessions, selectedId: clicked.id, explicitSelection: true, selectionToken };
  }
  const selected = sessions.find(item => item.id === current.selectedId);
  const previous = current.sessions.find(item => item.id === current.selectedId);
  const started = sessions.find(item => item.id !== current.selectedId && isPlaying(item)
    && !isPlaying(current.sessions.find(old => old.id === item.id)));
  const explicitSelection = Boolean(selected && current.explicitSelection && !(isPlaying(previous) && !isPlaying(selected)));
  const automatic = started || (!selected || !explicitSelection && !isPlaying(selected) ? sessions.find(isPlaying) : undefined);
  return { sessions, selectedId: automatic?.id || selected?.id || sessions[0]?.id || '',
    explicitSelection: !automatic && explicitSelection, selectionToken };
}

// Keep discovery alive even while the music panel is hidden.
export function useBrowserMusic() {
  const { t } = useI18n();
  const [{ sessions, selectedId }, setMusic] = useState<MusicSelection>({ sessions: [], selectedId: '', explicitSelection: false, selectionToken: '' });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await sendMusicRequest('sessions.get');
        if (!cancelled) {
          setMusic((current) => updateSelection(current, next, true)); setConnected(true); setChecking(false); setError('');
        }
      } catch (reason) {
        if (!cancelled) { setMusic((current) => ({ ...current, sessions: [], selectedId: '', explicitSelection: false })); setConnected(false); setChecking(false); setError(reason instanceof MusicBridgeError && reason.code === 'not-installed' ? '' : t('music.reconnect')); }
      } finally {
        if (!cancelled) timeout = setTimeout(poll, 2000);
      }
    };
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener('focus', reconnect);
    void poll();
    return () => { cancelled = true; clearTimeout(timeout); window.removeEventListener('focus', reconnect); };
  }, [attempt, t]);

  const selected = sessions.find((item) => item.id === selectedId);
  const setSelectedId = (id: string) => setMusic((current) => ({ ...current, selectedId: id, explicitSelection: true }));
  const updateClock = useCallback((sessionId: string, clock: MusicClock) => {
    setMusic((current) => {
      const previous = current.sessions.find(item => item.id === sessionId);
      if (!previous || (previous.sampledAt || 0) > clock.sampledAt) return current;
      return { ...current,
        explicitSelection: current.explicitSelection && !(current.selectedId === sessionId && isPlaying(previous) && !isPlaying({ ...previous, ...clock })),
        sessions: current.sessions.map(item => item.id === sessionId ? { ...item, ...clock } : item) };
    });
  }, []);
  const beat = useMusicBeatSync(selected?.id, updateClock);
  async function toggle() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const next = await sendMusicRequest(selected.paused ? 'media.play' : 'media.pause', selected.id);
      setMusic((current) => updateSelection(current, next)); setError('');
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
