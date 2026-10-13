import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createNativeAudioFeed } from './nativeAudio';
import { beatTelemetry, parseBeatTraces } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';

const receivers = new Set<(value: unknown) => void>();
const publish = (value: unknown) => { for (const receive of receivers) receive(value); };
const audioReceivers = new Set<(sessionId: string, samples: Float32Array, clock: PlaybackClock) => void>();
const audio = createNativeAudioFeed(publish, (sessionId, samples, clock) => {
  for (const receive of audioReceivers) receive(sessionId, samples, clock);
});
export function subscribeNativeAudio(receive: (sessionId: string, samples: Float32Array, clock: PlaybackClock) => void) {
  audioReceivers.add(receive);
  return () => { audioReceivers.delete(receive); };
}
// Register before sync.start. A single listener survives surface/layout swaps.
let ready: Promise<unknown> | undefined;
let audioOwner: { sessionId: string; subscriptionId: string } | undefined;
function ensureFeed() {
  return ready ??= (async () => {
    const stop = await listen<unknown>('native-music-beat', ({ payload }) => { if (audio.companion(payload)) publish(payload); });
    try { await listen<unknown>('native-audio-ended', ({ payload }) => audio.ended(payload)); }
    catch (error) { stop(); throw error; }
    // An optional diagnostic listener must not block capture/control setup.
    void listen<Record<string, unknown>>('native-beat-telemetry', ({ payload }) => {
      if (!payload || typeof payload.stage !== 'string') return;
      const traces = parseBeatTraces(payload.telemetry);
      const tracer = beatTelemetry.at(String(payload.component));
      if (traces?.length) tracer.mark(payload.stage, traces, payload);
      else tracer.record(payload.stage, undefined, payload);
    }).catch(() => {});
  })().catch((error) => { ready = undefined; throw error; });
}
export async function requestNativeMusic(action: string, sessionId?: string, subscriptionId?: string, value?: number): Promise<Record<string, unknown>> {
  const starting = action === 'dock.beat.sync.start' && sessionId && subscriptionId
    ? { sessionId, subscriptionId } : undefined;
  if (starting) audioOwner = starting;
  if (action === 'dock.beat.sync.stop' && audioOwner?.sessionId === sessionId && audioOwner?.subscriptionId === subscriptionId) audioOwner = undefined;
  await ensureFeed();
  if (action === 'dock.beat.sync.stop' && sessionId && subscriptionId) audio.stop(sessionId, subscriptionId);
  // Desktop includes the learned runtime and observes Windows process PCM.
  // Keep browser playback untouched; Companion provides discovery and clock.
  const response = await invoke<Record<string, unknown>>('native_music_request', { action, sessionId, subscriptionId,
    ...(value !== undefined ? { value } : {}),
    ...(action === 'dock.beat.sync.start' ? { nativeAudio: true } : {}) });
  if (response.ok === true && starting && audioOwner === starting) audio.activate(starting.sessionId, starting.subscriptionId);
  return response;
}
export function subscribeNativeMusic(receive: (value: unknown) => void) {
  receivers.add(receive);
  void ensureFeed().catch(() => {});
  return () => { receivers.delete(receive); };
}
export interface CompanionSetupResult {
  version: string;
  folder: string;
  status: 'ready' | 'reload-required' | 'install-required';
  browsersReady: number;
  folderOpened: boolean;
}
export const openNativeMusicSetup = () => invoke<CompanionSetupResult>('native_music_setup');
