import { useEffect, useRef, useState } from 'react';

import { readGlobalJSON } from '../../shared/storage/storageAdapter';

const BACK_ONLINE_VISIBLE_MS = 3000;

/**
 * Lightweight connectivity indicator driven by `navigator.onLine` plus the
 * `online` / `offline` window events. Non-blocking: it renders a fixed banner
 * at the bottom and never traps focus or covers interactive content.
 *
 * - While offline: persistent "You are offline. Changes may not sync." banner.
 * - On recovery: a transient "Back online." banner that auto-dismisses.
 * - Uses aria-live="polite" so screen readers announce status changes.
 *
 * This phase does not change any sync logic — it only reflects connectivity.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [cachedAt, setCachedAt] = useState<string | null>(() => readGlobalJSON<string | null>('last_board_cache_at', null));
  const [showBackOnline, setShowBackOnline] = useState(false);
  const backOnlineTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      setCachedAt(readGlobalJSON<string | null>('last_board_cache_at', null));
      setIsOnline(false);
      setShowBackOnline(false);
      if (backOnlineTimeoutRef.current !== null) {
        window.clearTimeout(backOnlineTimeoutRef.current);
        backOnlineTimeoutRef.current = null;
      }
    };

    const handleOnline = () => {
      setCachedAt(readGlobalJSON<string | null>('last_board_cache_at', null));
      setIsOnline(true);
      setShowBackOnline(true);
      if (backOnlineTimeoutRef.current !== null) {
        window.clearTimeout(backOnlineTimeoutRef.current);
      }
      backOnlineTimeoutRef.current = window.setTimeout(() => {
        setShowBackOnline(false);
        backOnlineTimeoutRef.current = null;
      }, BACK_ONLINE_VISIBLE_MS);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (backOnlineTimeoutRef.current !== null) {
        window.clearTimeout(backOnlineTimeoutRef.current);
      }
    };
  }, []);

  const isVisible = !isOnline || showBackOnline;
  const cachedTimeLabel = cachedAt
    ? new Date(cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4"
    >
      {isVisible && (
        <div
          className={`pointer-events-auto rounded-full border px-4 py-2 text-sm font-medium shadow-card transition-colors ${
            isOnline
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {isOnline
            ? 'Back online.'
            : `You are offline. ${cachedTimeLabel ? `Cached board from ${cachedTimeLabel} is available.` : 'Changes may not sync.'}`}
        </div>
      )}
    </div>
  );
}
