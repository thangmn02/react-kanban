import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createNativeAudioFeed } from './nativeAudio';
import { beatTelemetry, parseBeatTraces } from '../../../extensions/kanban-music/beat-telemetry.js';

const receivers = new Set<(value: unknown) => void>();
const publish = (value: unknown) => { for (const receive of receivers) receive(value); };
const audio = createNativeAudioFeed(publish);
// Register before sync.start. A single listener survives surface/layout swaps.
let ready: Promise<unknown> | undefined;
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
export async function requestNativeMusic(action: string, sessionId?: string, subscriptionId?: string): Promise<Record<string, unknown>> {
  await ensureFeed();
  if (action === 'dock.beat.sync.stop' && sessionId && subscriptionId) audio.stop(sessionId, subscriptionId);
  const response = await invoke<Record<string, unknown>>('native_music_request', { action, sessionId, subscriptionId,
    ...(action === 'dock.beat.sync.start' ? { nativeAudio: true } : {}) });
  if (response.ok === true && action === 'dock.beat.sync.start' && sessionId && subscriptionId) audio.activate(sessionId, subscriptionId);
  return response;
}
export function subscribeNativeMusic(receive: (value: unknown) => void) {
  receivers.add(receive);
  void ensureFeed().catch(() => {});
  return () => { receivers.delete(receive); };
}
export const openNativeMusicSetup = () => invoke<void>('native_music_setup');
