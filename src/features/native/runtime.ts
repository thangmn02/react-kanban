import { isTauri } from '@tauri-apps/api/core';

export type BeatSource = 'extension-direct' | 'tauri-events' | 'none';
export const isNativeWidget = () => isTauri();
export const getBeatSource = (connected: boolean): BeatSource => connected ? isNativeWidget() ? 'tauri-events' : 'extension-direct' : 'none';
