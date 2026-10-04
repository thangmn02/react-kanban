import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const receivers = new Set<(value: unknown) => void>();
// Register before sync.start. A single listener survives surface/layout swaps.
let ready: Promise<unknown> | undefined;
function ensureFeed() {
  return ready ??= listen<unknown>('native-music-beat', ({ payload }) => {
    for (const receive of receivers) receive(payload);
  }).catch((error) => { ready = undefined; throw error; });
}
export async function requestNativeMusic(action: string, sessionId?: string, subscriptionId?: string): Promise<Record<string, unknown>> {
  await ensureFeed();
  return invoke('native_music_request', { action, sessionId, subscriptionId });
}
export function subscribeNativeMusic(receive: (value: unknown) => void) {
  receivers.add(receive);
  void ensureFeed().catch(() => {});
  return () => { receivers.delete(receive); };
}
export const openNativeMusicSetup = () => invoke<void>('native_music_setup');
