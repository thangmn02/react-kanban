import { useCallback, useEffect, useState } from 'react';

export type HomeAppearance = 'default' | 'doodle' | 'paper' | 'retrotune';

const STORAGE_KEY = 'home-appearance';

const VALID: HomeAppearance[] = ['default', 'doodle', 'paper', 'retrotune'];

function readStoredAppearance(): HomeAppearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (VALID as string[]).includes(stored)) {
      return stored as HomeAppearance;
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

export function useHomeAppearance() {
  const [appearance, setAppearanceState] = useState<HomeAppearance>(readStoredAppearance);

  // Sync to localStorage on change.
  const setAppearance = useCallback((next: HomeAppearance) => {
    writeStoredAppearance(next);
    setAppearanceState(next);
  }, []);

  // Apply data-home-theme attribute to body so global CSS rules can scope.
  useEffect(() => {
    document.body.setAttribute('data-home-theme', appearance);
    return () => {
      document.body.removeAttribute('data-home-theme');
    };
  }, [appearance]);

  return { appearance, setAppearance };
}
