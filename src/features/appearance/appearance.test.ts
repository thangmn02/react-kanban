import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { APPEARANCE_KEY, readAppearance, resolveAppearance, useAppearance, writeAppearance } from './appearance';

let systemDark = false;
const listeners = new Set<(event: MediaQueryListEvent) => void>();
beforeEach(() => {
  localStorage.clear(); systemDark = false; listeners.clear();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return systemDark; },
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener) }));
});
afterEach(() => vi.unstubAllGlobals());

it('defaults to System with the blue accent and rejects unknown stored values', () => {
  expect(readAppearance()).toEqual({ appearance: 'system', accent: 'blue' });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ appearance: 'sepia', accent: 'chartreuse' }));
  expect(readAppearance()).toEqual({ appearance: 'system', accent: 'blue' });
  localStorage.setItem(APPEARANCE_KEY, '{not json');
  expect(readAppearance()).toEqual({ appearance: 'system', accent: 'blue' });
});

it('resolves System from the computer and keeps an explicit choice', () => {
  expect(resolveAppearance('system', true)).toBe('dark');
  expect(resolveAppearance('system', false)).toBe('light');
  expect(resolveAppearance('light', true)).toBe('light');
  expect(resolveAppearance('dark', false)).toBe('dark');
});

it('follows the computer while on System, and every change made elsewhere', () => {
  const { result } = renderHook(() => useAppearance());
  expect(result.current.resolved).toBe('light');
  act(() => { systemDark = true; listeners.forEach(listener => listener({ matches: true } as MediaQueryListEvent)); });
  expect(result.current.resolved).toBe('dark');
  act(() => result.current.setAppearance('light'));
  expect(result.current).toMatchObject({ appearance: 'light', resolved: 'light' });
  act(() => writeAppearance({ accent: 'violet' }));
  expect(result.current.accent).toBe('violet');
  // Another Kora window (the native dock) writes the same key.
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ appearance: 'dark', accent: 'green' }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY })); });
  expect(result.current).toMatchObject({ appearance: 'dark', resolved: 'dark', accent: 'green' });
});
