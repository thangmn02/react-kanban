import { useEffect, useState } from 'react';

export type Appearance = 'system' | 'light' | 'dark';
export type ResolvedAppearance = 'light' | 'dark';
// Each accent re-tints the blue ramp that drives actions, links and focus (src/styles/kora-appearance.css).
export const accents = ['blue', 'indigo', 'violet', 'pink', 'orange', 'green'] as const;
export type Accent = typeof accents[number];
export interface AppearancePreference { appearance: Appearance; accent: Accent }

export const APPEARANCE_KEY = 'kora.appearance.v1';
const CHANGE_EVENT = 'kora:appearance';
const appearances: Appearance[] = ['system', 'light', 'dark'];
const fallback: AppearancePreference = { appearance: 'system', accent: 'blue' };

export function readAppearance(): AppearancePreference {
  try {
    const value = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null');
    return { appearance: appearances.includes(value?.appearance) ? value.appearance : fallback.appearance,
      accent: accents.includes(value?.accent) ? value.accent : fallback.accent };
  } catch { return fallback; }
}
export function writeAppearance(next: Partial<AppearancePreference>) {
  const value = { ...readAppearance(), ...next };
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(value)); } catch { /* Without storage it lasts for this window only. */ }
  window.dispatchEvent(new CustomEvent<AppearancePreference>(CHANGE_EVENT, { detail: value }));
}

const darkQuery = () => typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
export const resolveAppearance = (appearance: Appearance, systemDark = Boolean(darkQuery()?.matches)): ResolvedAppearance =>
  appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance;

/** The stored choice, the mode it resolves to now, and setters. Every Kora window follows a change made in any other. */
export function useAppearance() {
  const [preference, setPreference] = useState(readAppearance);
  const [systemDark, setSystemDark] = useState(() => Boolean(darkQuery()?.matches));
  useEffect(() => {
    const query = darkQuery();
    const system = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    const local = (event: Event) => setPreference((event as CustomEvent<AppearancePreference>).detail ?? readAppearance());
    const storage = (event: StorageEvent) => { if (event.key === APPEARANCE_KEY || event.key === null) setPreference(readAppearance()); };
    query?.addEventListener('change', system);
    window.addEventListener(CHANGE_EVENT, local);
    window.addEventListener('storage', storage);
    return () => { query?.removeEventListener('change', system); window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener('storage', storage); };
  }, []);
  return { ...preference, resolved: resolveAppearance(preference.appearance, systemDark),
    setAppearance: (appearance: Appearance) => writeAppearance({ appearance }),
    setAccent: (accent: Accent) => writeAppearance({ accent }) };
}
