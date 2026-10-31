import { isTauri } from '@tauri-apps/api/core';

export type BeatSource = 'extension-direct' | 'tauri-events' | 'none';
export const isNativeWidget = () => isTauri();
export const nativeCompanionPreviewEnabled = () => isNativeWidget() && import.meta.env.VITE_PRIVATE_NATIVE_COMPANION_CAPTURE === 'true';
export const nativeSourceAudioDelayEnabled = () => isNativeWidget() && import.meta.env.VITE_ENABLE_SOURCE_AUDIO_DELAY === 'true';
export const getBeatSource = (connected: boolean): BeatSource => connected ? isNativeWidget() ? 'tauri-events' : 'extension-direct' : 'none';
