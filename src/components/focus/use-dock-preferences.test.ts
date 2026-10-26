import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {useDockPreferences} from './useDockPreferences';
afterEach(()=>{cleanup();localStorage.clear();});
it('persists motion style and reduction through the existing Dock preference mechanism',()=>{
  const first=renderHook(()=>useDockPreferences());
  expect(first.result.current.motionProfile).toBe('focus');expect(first.result.current.motionReduction).toBe('system');
  act(()=>{first.result.current.setMotionProfile('dynamic');first.result.current.setMotionReduction('reduced');});
  first.unmount();const next=renderHook(()=>useDockPreferences());
  expect(next.result.current.motionProfile).toBe('dynamic');expect(next.result.current.motionReduction).toBe('reduced');
  expect(next.result.current.colorMode).toBe('random');
});
it('ignores unsupported saved motion values instead of enabling an unknown profile',()=>{
  localStorage.setItem('floatingDock.motionProfile','strobe');localStorage.setItem('floatingDock.motionReduction','off');
  const {result}=renderHook(()=>useDockPreferences());expect(result.current.motionProfile).toBe('focus');expect(result.current.motionReduction).toBe('system');
});
