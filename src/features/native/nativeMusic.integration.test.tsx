import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useBrowserMusic } from '../music/useBrowserMusic';
import BeatPattern from '../music/BeatPattern';
import { sendMusicRequest } from '../music/mediaBridge';
import type { NativeAudioCallbacks } from '../../../extensions/kanban-music/native-audio-engine.js';
import { LEAD_ANALYSIS_VERSION } from '../music/lead-events';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import { invoke } from '@tauri-apps/api/core';

const native = vi.hoisted(() => ({ receive: new Map<string, (event: { payload: unknown }) => void>(), subscription: '',
  cached: false, learned: false,
  detectors: [] as { options: NativeAudioCallbacks; id: string }[] }));
vi.mock('../../../extensions/kanban-music/native-audio-engine.js', () => ({ createNativeAudioEngine(options: NativeAudioCallbacks) {
  const detector={options,id:''};native.detectors.push(detector);
  return {start:async (id: string)=>{detector.id=id;return true;},push:()=>true,renew:()=>true,stop:()=>{}};
} }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, Channel: class { onmessage: (data: ArrayBuffer) => void = () => {}; }, invoke: vi.fn(async (_command, args) => {
  if (args.action === 'dock.beat.sync.start') native.subscription = args.subscriptionId;
  return { ok: true, sessions: [{ id: 'native:song', title: 'Browser song', artist: 'Artist', source: 'music.youtube.com', paused: false, playing: true,
    learnedPercussion: native.learned,
    ...(native.cached ? { asset:{provider:'youtube',id:'abcdefghijk'},duration:30 } : {}) }] };
}) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (name, receive) => { native.receive.set(name,receive); return () => native.receive.delete(name); }) }));
beforeEach(() => { native.subscription = '';native.detectors.length=0;native.cached=false;native.learned=false; });
afterEach(() => { cleanup();vi.restoreAllMocks();vi.unstubAllEnvs();beatTelemetry.enable(false);beatTelemetry.clear(); });
function Harness({demand=false,melodyEnabled=false}:{demand?:boolean;melodyEnabled?:boolean}) {
  const music = useBrowserMusic(demand);
  return <><span>{music.source}</span><span data-testid="lead-status">{music.beat.leadAvailability} {music.beat.lead?.source} {music.beat.lead?.kind}</span><BeatPattern melodyEnabled={melodyEnabled} session={music.selected} beat={music.beat} /></>;
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
it('uses equipped Companion inference for all four native rows without a competing PCM detector', async () => {
  native.learned = true;
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await waitFor(() => expect(native.subscription).not.toBe(''));
  expect(invoke).toHaveBeenCalledWith('native_music_request', expect.objectContaining({ action: 'dock.beat.sync.start', nativeAudio: false }));
  act(() => emit({ kind: 'clock', clock: { playing: true, paused: false, currentTime: 1, playbackRate: 1, sampledAt: Date.now() } }));
  act(() => emit({ kind: 'sync.state', mode: 'capture', captureId: 'companion-learned' }));
  act(() => emit({ kind: 'onset', captureId: 'companion-learned', sequence: 1, bands: ['kick', 'clap', 'hat', 'bass'] }));
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel] .beat-square.onset').length).toBeGreaterThanOrEqual(4));
  expect(native.detectors).toHaveLength(0);
  act(() => emit({ kind: 'clock', clock: { playing: false, paused: true, currentTime: 1.2, playbackRate: 1, sampledAt: Date.now() } }));
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
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

it('rejects retired native instrumental events without exposing the paused Melody row', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await waitFor(() => expect(native.subscription).not.toBe(''));
  const detector=await startDetector();
  expect(detector.options).not.toHaveProperty('onMelody');
  act(() => emit({ kind:'melody.state', detector:'instrument-v1', captureId:detector.id, melody:{active:true,level:.6,note:1} }));
  await act(async () => { await new Promise(resolve=>setTimeout(resolve,0)); });
  expect(view.container.querySelectorAll('.beat-channel')).toHaveLength(4);
  expect(view.container.querySelectorAll('.melody-beat-flash')).toHaveLength(0);
});

it('delivers versioned unpitched Lead from the HTTPS cache through the native controller into only Row 5', async () => {
  native.cached=true;beatTelemetry.enable();vi.stubEnv('DEV',false);vi.stubEnv('VITE_LEAD_PULSE_ENABLED','true');
  const lead={policyVersion:'lead-pulse-v1',source:'vocals',kind:'vocal-articulation',detector:'vocal-body-articulation',inputSha256:'a'.repeat(64)};
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async url=>String(url).includes('chunk=')
    ?Response.json({version:1,revision:'r',index:0,events:[{id:'vocal-attack',row:'melody',time:1.1,duration:.08,confidence:.6,lead}]})
    :Response.json({version:1,revision:'r',asset:{provider:'youtube',id:'abcdefghijk'},duration:30,chunkSeconds:30,analysisVersion:LEAD_ANALYSIS_VERSION,melodyPolicy:'dominant-monophonic'}));
  const view=render(<I18nProvider><Harness demand melodyEnabled /></I18nProvider>);
  await waitFor(()=>expect(native.subscription).not.toBe(''));
  act(()=>emit({kind:'clock',clock:{playing:true,paused:false,currentTime:1,playbackRate:1,sampledAt:Date.now()}}));
  await waitFor(()=>expect(view.container.querySelector('.melody-beat-flash')).not.toBeNull());
  expect(view.getByTestId('lead-status')).toHaveTextContent('ready vocals vocal-articulation');
  expect(view.container.querySelectorAll('[data-channel="drum"] .onset, [data-channel="clap"] .onset, [data-channel="hat"] .onset, [data-channel="bass"] .bass-beat-flash')).toHaveLength(0);
  expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('https://koraspace.online/api/beat-events?')&&String(url).includes(LEAD_ANALYSIS_VERSION))).toBe(true);
  const flash=view.container.querySelector('.melody-beat-flash');expect(flash).toHaveAttribute('data-target-playback-time','1.1');
  act(()=>emit({kind:'clock',clock:{playing:false,paused:true,currentTime:1.2,playbackRate:1,sampledAt:Date.now()}}));
  expect(view.container.querySelector('.melody-beat-flash')).toBeNull();
});
