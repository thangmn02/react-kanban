import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useBrowserMusic } from '../music/useBrowserMusic';
import BeatPattern from '../music/BeatPattern';
import { sendMusicRequest } from '../music/mediaBridge';

const native = vi.hoisted(() => ({ receive: undefined as undefined | ((event: { payload: unknown }) => void), subscription: '' }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn(async (_command, args) => {
  if (args.action === 'dock.beat.sync.start') native.subscription = args.subscriptionId;
  return { ok: true, sessions: [{ id: 'native:song', title: 'Native song', artist: 'Artist', source: 'Windows player', paused: false, playing: true }] };
}) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (_name, receive) => { native.receive = receive; return () => {}; }) }));
beforeEach(() => { native.subscription = ''; });
afterEach(() => { cleanup(); });
function Harness() {
  const music = useBrowserMusic();
  return <><span>{music.source}</span><BeatPattern session={music.selected} beat={music.beat} /></>;
}
function emit(event: object, emittedAt = Date.now()) {
  native.receive?.({ payload: { sessionId: 'native:song', subscriptionId: native.subscription, emittedAt, ...event } });
}
it('routes native SMTC metadata without a browser extension', async () => {
  await expect(sendMusicRequest('sessions.get')).resolves.toEqual([expect.objectContaining({ title: 'Native song' })]);
});
it('pops only the matching native onset row, rejects old/duplicate events, and clears on silence', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await waitFor(() => expect(native.subscription).not.toBe(''));
  expect(view.container.textContent).toContain('tauri-events');
  act(() => emit({ kind: 'sync.state', mode: 'capture', captureId: 'native-capture' }));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  act(() => emit({ kind: 'onset', captureId: 'native-capture', sequence: 1, bands: ['snare'] }));
  await waitFor(() => expect(view.container.querySelector('[data-channel="snare"] .beat-square.onset')).not.toBeNull());
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset, .channel-icon.onset')).toHaveLength(0);
  const square = view.container.querySelector('[data-channel="snare"] .beat-square.onset');
  act(() => {
    emit({ kind: 'onset', captureId: 'native-capture', sequence: 1, bands: ['kick'] });
    emit({ kind: 'onset', captureId: 'old-capture', sequence: 2, bands: ['kick'] });
    emit({ kind: 'onset', captureId: 'native-capture', sequence: 2, bands: ['kick'] }, Date.now() - 2000);
  });
  expect(view.container.querySelector('[data-channel="snare"] .beat-square.onset')).toBe(square);
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset')).toHaveLength(0);
  act(() => emit({ kind: 'sync.state', mode: 'clock', reason: 'silent' }));
  expect(view.container.querySelectorAll('.beat-square.onset, .beat-square.lit')).toHaveLength(0);
  act(() => emit({ kind: 'onset', captureId: 'native-capture', sequence: 3, bands: ['kick'] }));
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
});
