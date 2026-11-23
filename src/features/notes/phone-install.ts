import { useEffect, useState } from 'react';

/** Chrome's install prompt event (not in the DOM typings). */
interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISSED = 'kora:phone-install-hint-dismissed:v1';
const HEAD_LINKS: [string, Record<string, string>][] = [
  ['manifest', { rel: 'manifest', href: '/kora-notes.webmanifest' }],
  ['apple-icon', { rel: 'apple-touch-icon', href: '/icons/kora-notes-apple-180.png' }],
  ['apple-capable', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
  ['mobile-capable', { name: 'mobile-web-app-capable', content: 'yes' }],
  ['apple-title', { name: 'apple-mobile-web-app-title', content: 'Kora Notes' }],
];

/** Adds the Kora Notes manifest and home-screen icon only while the phone page is open, so the rest of the site is unchanged. */
export function usePhoneAppHead() {
  useEffect(() => {
    const added = HEAD_LINKS.map(([key, attributes]) => {
      const element = document.createElement(attributes.rel ? 'link' : 'meta');
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      element.setAttribute('data-kora-phone', key);
      document.head.append(element);
      return element;
    });
    return () => added.forEach(element => element.remove());
  }, []);
}

export function isStandalone() {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

/** iPhone and iPad Safari, where installing is Share → Add to Home Screen (no install prompt). */
export function isAppleMobile(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(userAgent) || /Macintosh/.test(userAgent) && touchPoints > 1;
}

/** Which install hint to show: Chrome's prompt when offered, the iPhone steps, or none (installed, dismissed, or not supported). */
export function usePhoneInstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; } });
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', done); };
  }, []);
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISSED, '1'); } catch { /* the hint simply returns next visit */ } };
  const kind: 'prompt' | 'apple' | null = installed || dismissed ? null : prompt ? 'prompt' : isAppleMobile() ? 'apple' : null;
  const install = async () => { if (!prompt) return; await prompt.prompt(); const { outcome } = await prompt.userChoice; setPrompt(null); if (outcome === 'accepted') setInstalled(true); };
  return { kind, install, dismiss };
}
