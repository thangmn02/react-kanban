import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }
let loading: Promise<TurnstileApi> | undefined;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error('verification')); };
    const timeout = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    document.head.append(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export default function TurnstileWidget({ siteKey, language, resetKey, onToken, onError }: {
  siteKey: string;
  language: 'en' | 'vi';
  resetKey: number;
  onToken: (token: string) => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;
    let api: TurnstileApi | undefined;
    onToken('');
    void loadTurnstile().then(loaded => {
      if (cancelled || !container.current) return;
      api = loaded;
      widgetId = loaded.render(container.current, { sitekey: siteKey, action: 'contact', language,
        appearance: 'interaction-only', 'refresh-expired': 'auto',
        callback: (token: string) => { if (!cancelled) onToken(token); },
        'expired-callback': () => { if (!cancelled) onToken(''); },
        'error-callback': () => { if (!cancelled) { onToken(''); onError(); } },
      });
    }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; if (widgetId !== undefined) api?.remove(widgetId); };
  }, [siteKey, language, resetKey, onToken, onError]);
  return <div ref={container} />;
}
