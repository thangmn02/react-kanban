import { useCallback, useState } from 'react';

export type HomeAppearance = 'default' | 'doodle' | 'paper';

const STORAGE_KEY = 'home-appearance';

const VALID: HomeAppearance[] = ['default', 'doodle', 'paper'];

function readStoredAppearance(): HomeAppearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (VALID as string[]).includes(stored)) {
      return stored as HomeAppearance;
    }
    // The retired "retrotune" theme migrates to the default appearance so a
    // previously-stored value never leaves a user on a removed theme.
    if (stored === 'retrotune') {
      writeStoredAppearance('default');
    }
  } catch {
    // ignore — localStorage unavailable in SSR / sandboxed contexts
  }
  return 'default';
}

function writeStoredAppearance(value: HomeAppearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

/**
 * Home appearance preference. The chosen value is returned so the caller can
 * scope the `data-home-theme` attribute to the Home surface only — it is
 * intentionally NOT written to `document.body`, so themes never leak onto the
 * auth screen or any other route.
 */
export function useHomeAppearance() {
  const [appearance, setAppearanceState] = useState<HomeAppearance>(readStoredAppearance);

  const setAppearance = useCallback((next: HomeAppearance) => {
    writeStoredAppearance(next);
    setAppearanceState(next);
  }, []);

  return { appearance, setAppearance };
}
