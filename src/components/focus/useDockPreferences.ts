import { useEffect, useState } from 'react';
import type { BeatColorMode, BeatPalette } from '../../features/music/beatVisuals';
import type {MotionProfile,MotionReduction} from '../../features/music/semantic-motion';

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
  const [motionProfile,setMotionProfile]=useState<MotionProfile>(()=>storedChoice('floatingDock.motionProfile',['focus','dynamic'],'focus'));
  const [motionReduction,setMotionReduction]=useState<MotionReduction>(()=>storedChoice('floatingDock.motionReduction',['system','reduced'],'system'));
  useEffect(() => { try { window.localStorage.removeItem('floatingDock.style'); } catch { /* Old layouts cannot override Tabs. */ } }, []);
  useEffect(() => { try { window.localStorage.setItem('floatingDock.colors', colorMode); } catch { /* Preferences remain usable this session. */ } }, [colorMode]);
  useEffect(() => { try { window.localStorage.setItem('floatingDock.palette', palette); } catch { /* Preferences remain usable this session. */ } }, [palette]);
  useEffect(()=>{try{window.localStorage.setItem('floatingDock.motionProfile',motionProfile);}catch{/* Session preference still works. */}},[motionProfile]);
  useEffect(()=>{try{window.localStorage.setItem('floatingDock.motionReduction',motionReduction);}catch{/* Session preference still works. */}},[motionReduction]);
  return { colorMode, setColorMode, palette, setPalette,motionProfile,setMotionProfile,motionReduction,setMotionReduction };
}
