import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useBrowserMusic } from '../music/useBrowserMusic';
import BeatPattern from '../music/BeatPattern';
import { sendMusicRequest } from '../music/mediaBridge';
import type { NativeAudioCallbacks } from '../../../extensions/kanban-music/native-audio-engine.js';

const native = vi.hoisted(() => ({ receive: new Map<string, (event: { payload: unknown }) => void>(), subscription: '',
  detectors: [] as { options: NativeAudioCallbacks; id: string }[] }));
vi.mock('../../../extensions/kanban-music/native-audio-engine.js', () => ({ createNativeAudioEngine(options: NativeAudioCallbacks) {
  const detector={options,id:''};native.detectors.push(detector);
  return {start:async (id: string)=>{detector.id=id;return true;},push:()=>true,renew:()=>true,stop:()=>{}};
} }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, Channel: class { onmessage: (data: ArrayBuffer) => void = () => {}; }, invoke: vi.fn(async (_command, args) => {
  if (args.action === 'dock.beat.sync.start') native.subscription = args.subscriptionId;
  return { ok: true, sessions: [{ id: 'native:song', title: 'Browser song', artist: 'Artist', source: 'music.youtube.com', paused: false, playing: true }] };
}) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (name, receive) => { native.receive.set(name,receive); return () => native.receive.delete(name); }) }));
beforeEach(() => { native.subscription = '';native.detectors.length=0; });
afterEach(() => { cleanup(); });
function Harness() {
  const music = useBrowserMusic();
  return <><span>{music.source}</span><BeatPattern session={music.selected} beat={music.beat} /></>;
}
function emit(event: object, emittedAt = Date.now()) {
  native.receive.get('native-music-beat')?.({ payload: { sessionId: 'native:song', subscriptionId: native.subscription, emittedAt, ...event } });
}
async function startDetector() {
  act(() => emit({kind:'clock',clock:{playing:true,paused:false,currentTime:1,playbackRate:1,sampledAt:Date.now()}}));
  await waitFor(() => expect(native.detectors.at(-1)?.id).toBeTruthy());
  const detector=native.detectors.at(-1)!;
  act(() => detector.options.onAudible(detector.id));
  await act(async () => {await new Promise(resolve=>setTimeout(resolve,0));});
  return detector;
}
it('routes browser companion metadata through the native event transport', async () => {
  await expect(sendMusicRequest('sessions.get')).resolves.toEqual([expect.objectContaining({ title: 'Browser song', source: 'music.youtube.com' })]);
});
it('pops native onset rows, ignores companion fallback events, and clears on silence', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await waitFor(() => expect(native.subscription).not.toBe(''));
  expect(view.container.textContent).toContain('tauri-events');
  const detector=await startDetector();
  act(() => detector.options.onBeat(detector.id,['clap']));
  await waitFor(() => expect(view.container.querySelector('[data-channel="clap"] .beat-square.onset')).not.toBeNull());
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset, .channel-icon.onset')).toHaveLength(0);
  const square = view.container.querySelector('[data-channel="clap"] .beat-square.onset');
  act(() => {
    emit({ kind: 'onset', captureId: 'native-capture', sequence: 1, bands: ['kick'] });
    emit({ kind: 'onset', captureId: 'old-capture', sequence: 2, bands: ['kick'] });
    emit({ kind: 'onset', captureId: 'native-capture', sequence: 2, bands: ['kick'] }, Date.now() - 2000);
  });
  expect(view.container.querySelector('[data-channel="clap"] .beat-square.onset')).toBe(square);
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset')).toHaveLength(0);
  act(() => detector.options.onStop(detector.id,'silent'));
  expect(view.container.querySelectorAll('.beat-square.onset, .beat-square.lit')).toHaveLength(0);
  act(() => emit({ kind: 'onset', captureId: 'native-capture', sequence: 3, bands: ['kick'] }));
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
});

it('renders instrumental events from the current native detector and clears them on silence', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await waitFor(() => expect(native.subscription).not.toBe(''));
  const detector=await startDetector();
  act(() => detector.options.onMelody(detector.id,{active:true,level:.6,note:1}));
  expect(view.container.querySelector('[data-channel="melody"] .melody-held')).toBeNull();
  await waitFor(() => expect(view.container.querySelector('[data-channel="melody"] .melody-beat-flash')).not.toBeNull());
  expect(view.container.querySelectorAll('.channel-icon.onset, .channel-icon.melody-held')).toHaveLength(0);
  act(() => detector.options.onMelody(detector.id,{active:false,level:0,note:1}));
  expect(view.container.querySelectorAll('.melody-held')).toHaveLength(0);
  expect(view.container.querySelectorAll('.melody-beat-flash')).toHaveLength(0);
});
