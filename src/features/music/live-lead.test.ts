import { expect, it } from 'vitest';
import { decideBeatMode } from '../../../extensions/kanban-music/beat-mode.js';
import { liveLeadAvailable } from './live-lead';

const running = decideBeatMode({ privateCandidate: true, health: { leadLive: true } });
it('shows the fifth row only for an active capture whose live Lead tracker is running', () => {
  expect(liveLeadAvailable(running, 'capture')).toBe(true);
  expect(liveLeadAvailable(running, 'clock')).toBe(false);
  expect(liveLeadAvailable(decideBeatMode({ privateCandidate: true }), 'capture')).toBe(false);
  expect(liveLeadAvailable(undefined, 'capture')).toBe(false);
});
it('leaves saved-analysis Hybrid Beta in charge of its own Melody switch', () => {
  expect(liveLeadAvailable(running, 'capture', true)).toBe(false);
});
