import { useEffect, useState } from 'react';
import type { BeatColorMode, BeatPalette } from '../../features/music/beatVisuals';

export const beatColorModes: BeatColorMode[] = ['random', 'pastel', 'flow'];
export const beatPalettes: BeatPalette[] = ['bloom', 'ultraviolet'];

function storedChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return choices.find((choice) => choice === value) || fallback;
  } catch { return fallback; }
}

export function useDockPreferences() {
  const [colorMode, setColorMode] = useState<BeatColorMode>(() => storedChoice('floatingDock.colors', beatColorModes, 'random'));
  const [palette, setPalette] = useState<BeatPalette>(() => storedChoice('floatingDock.palette', beatPalettes, 'bloom'));
  useEffect(() => { try { window.localStorage.removeItem('floatingDock.style'); } catch { /* Old layouts cannot override Tabs. */ } }, []);
  useEffect(() => { try { window.localStorage.setItem('floatingDock.colors', colorMode); } catch { /* Preferences remain usable this session. */ } }, [colorMode]);
  useEffect(() => { try { window.localStorage.setItem('floatingDock.palette', palette); } catch { /* Preferences remain usable this session. */ } }, [palette]);
  return { colorMode, setColorMode, palette, setPalette };
}
