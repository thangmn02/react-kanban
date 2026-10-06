import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createCaptureEngine } from './capture-engine.js';
import { createBeatSync } from './beat-sync.js';
import { beatTelemetry } from './beat-telemetry.js';
import { useMusicBeatSync } from '../../src/features/music/useMusicBeatSync';
import BeatPattern from '../../src/features/music/BeatPattern';

// jsdom does not expose AnimationEvent; React otherwise selects a legacy
// prefixed event name. Supply the browser capability before React is imported.
vi.hoisted(() => { window.AnimationEvent ??= class extends Event {}; });

afterEach(() => { cleanup(); beatTelemetry.enable(false); beatTelemetry.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('follows an actual detector event through sync, page transport, controller and CSS animation start', async () => {
  vi.useFakeTimers(); beatTelemetry.enable();
  const session = { id: 'song', title: '', artist: '', source: '', playing: true, paused: false, currentTime: 0, tabId: 1, documentId: 'music-doc' };
  const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
  let energy = -60, sync;
  const context = { sampleRate: 44100, state: 'running', currentTime: 0, destination: {}, resume: async () => {}, close: async () => {},
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createAnalyser: () => ({ frequencyBinCount: 1024, disconnect() {}, getFloatFrequencyData: (values) => values.fill(energy) }) };
  const forward = (message) => sync.offscreen(message, { url: 'chrome-extension://companion/offscreen.html' });
  const engine = createCaptureEngine({ getUserMedia: async () => stream, createAudioContext: () => context, now: Date.now,
    onAudible: (captureId) => forward({ kind: 'audible', captureId }),
    onStop: (captureId, reason) => forward({ kind: 'stopped', captureId, reason }),
    onBeat: (captureId, bands, telemetry) => forward({ kind: 'onset', captureId, bands, telemetry }),
    onTempo() {}, onTempoTick() {}, onMelody() {} });
  const dispatch = (message) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { ...message, channel: 'kanban-music-v1', direction: 'extension-event' } }));
  const api = { runtime: { getURL: (name) => `chrome-extension://companion/${name}`, getContexts: async () => [],
    sendMessage: async (message) => {
      if (message.kind === 'start') return { ok: await engine.start(message.streamId, message.captureId) };
      if (message.kind === 'lease') return { ok: engine.renew(message.captureId) };
      if (message.kind === 'stop') engine.stopCapture(message.captureId);
      return { ok: true };
    } },
    tabs: { sendMessage: async (_, message) => { if (message.event === 'beat') dispatch(message); return { ok: true }; } },
    offscreen: { createDocument: async () => {}, closeDocument: async () => {} }, tabCapture: { getMediaStreamId: async () => 'stream' } };
  sync = createBeatSync(api);
  vi.spyOn(window, 'postMessage').mockImplementation((request) => {
    if (request.direction !== 'app-to-extension') return;
    const response = () => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
      data: { channel: request.channel, direction: 'extension-to-app', requestId: request.requestId, ok: true } }));
    if (request.action === 'dock.beat.sync.start') void sync.start(session, { tabId: 2, documentId: 'app-doc' }, request.subscriptionId).then(response);
    else void sync.stop().then(response);
  });
  const onClock = () => {};
  function Harness() { return React.createElement(BeatPattern, { session, beat: useMusicBeatSync('song', onClock) }); }
  const view = render(React.createElement(Harness));
  await act(async () => { await vi.advanceTimersByTimeAsync(450); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  energy = -20;
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const cell = view.container.querySelector('[data-channel="drum"] .onset');
  expect(cell).not.toBeNull();
  const id = cell.dataset.beatTrace;
  expect(id).toBeTruthy();
  fireEvent.animationStart(cell, { animationName: 'square-onset' });
  const trace = beatTelemetry.snapshot().records.filter((r) => r.id === id);
  expect(trace.map((r) => r.stage)).toEqual(expect.arrayContaining(['EVENT_DETECTED', 'EVENT_QUEUED', 'EVENT_SENT', 'EVENT_RECEIVED', 'EVENT_ACCEPTED', 'EVENT_STATE_COMMITTED', 'EVENT_COMMITTED', 'EVENT_RENDERED']));
  expect(trace.at(-1)).toMatchObject({ source: 'onset', type: 'kick', component: 'beat-renderer' });
  expect(view.container.querySelectorAll('[data-channel="melody"] .melody-beat-flash')).toHaveLength(0);
  energy = -Infinity;
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(track.stop).not.toHaveBeenCalled();
  energy = -20;
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const resumed = view.container.querySelector('[data-channel="drum"] .onset');
  expect(resumed).not.toBeNull();
  expect(resumed.dataset.beatTrace).not.toBe(id);
  fireEvent.animationStart(resumed, { animationName: 'square-onset' });
  expect(beatTelemetry.snapshot().records.filter((r) => r.id === resumed.dataset.beatTrace).map((r) => r.stage))
    .toEqual(expect.arrayContaining(['EVENT_DETECTED', 'EVENT_QUEUED', 'EVENT_SENT', 'EVENT_RECEIVED', 'EVENT_ACCEPTED', 'EVENT_STATE_COMMITTED', 'EVENT_COMMITTED', 'EVENT_RENDERED']));
  expect(beatTelemetry.snapshot().counts.CAPTURE_RECOVERED).toBeGreaterThan(0);
  engine.stop(); await sync.stop();
});
