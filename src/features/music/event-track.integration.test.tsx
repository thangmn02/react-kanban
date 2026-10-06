import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BeatPattern from './BeatPattern';
import { useMusicBeatSync } from './useMusicBeatSync';
import type { BeatEvent } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
// Match real browser event capability before React chooses its event names.
vi.hoisted(() => { window.AnimationEvent ??= class extends Event {
  readonly animationName: string; readonly elapsedTime: number; readonly pseudoElement: string;
  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init); this.animationName = init.animationName || ''; this.elapsedTime = init.elapsedTime || 0; this.pseudoElement = init.pseudoElement || '';
  }
}; });
const bridge = vi.hoisted(() => ({ receive: undefined as ((event: BeatEvent) => void) | undefined }));
vi.mock('./mediaBridge', () => ({ sendBeatRequest: vi.fn().mockResolvedValue(undefined),
  subscribeBeatEvents: (_id: string, _subscription: string, receive: (event: BeatEvent) => void) => {
    bridge.receive = receive; return () => { bridge.receive = undefined; };
  } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); beatTelemetry.enable(false); beatTelemetry.clear(); });
const update = () => {};
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const options = { asset, capabilities: { tier: 'clock-only' as const, captureClock: 'unavailable' as const } };
function Harness() {
  const beat = useMusicBeatSync('song', update, options);
  return <BeatPattern session={{ id: 'song', title: 'Annotated track', artist: '', source: '', playing: true, paused: false, currentTime: 10 }} beat={beat} />;
}
it('traces validated HTTP cache events through scheduling, controller, DOM and animation without local capture', async () => {
  vi.useFakeTimers(); vi.setSystemTime(10000); beatTelemetry.enable();
  const manifest = { version: 1, asset, revision: 'r', analysisVersion: 'annotated', duration: 60, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const chunk = new URL(String(url), 'https://kora.example').searchParams.get('chunk');
    return Response.json(chunk === null ? manifest : { version: 1, revision: 'r', index: Number(chunk),
      events: chunk === '0' ? [{ id: 'attack', row: 'kick', time: 10.25, confidence: .9 }] : [] });
  });
  const view = render(<Harness />);
  act(() => bridge.receive?.({ kind: 'clock', clock: { currentTime: 10, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(view.container.querySelector('.beat-square.onset')).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const cell = view.container.querySelector('.beat-square.onset')!; expect(cell).not.toBeNull();
  fireEvent.animationStart(cell, { animationName: 'square-onset' });
  const records = beatTelemetry.snapshot().records.filter(r => r.id === cell.getAttribute('data-beat-trace'));
  expect(records.map(r => r.stage)).toEqual(expect.arrayContaining(['EVENT_DETECTED', 'EVENT_SCHEDULED', 'EVENT_ACCEPTED',
    'EVENT_STATE_COMMITTED', 'EVENT_COMMITTED', 'EVENT_RENDERED']));
  expect(records.every(r => r.source === 'onset' && r.eventSource === 'cache' && r.targetPlaybackTime === 10.25)).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(3);
  act(() => bridge.receive?.({ kind: 'clock', clock: { currentTime: 10.25, sampledAt: Date.now(), playbackRate: 1, playing: false, paused: true } }));
  expect(view.container.querySelector('.beat-square.onset')).toBeNull();
});
