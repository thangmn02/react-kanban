import type { BeatMode } from '../../../extensions/kanban-music/beat-mode.js';

/**
 * The fifth Beat Grid row is shown only while the Companion reports a running live Lead tracker for
 * the active capture. Saved-analysis Hybrid Beta keeps its own Melody switch.
 */
export function liveLeadAvailable(capability: BeatMode | undefined, beatMode: string | undefined, betaEnabled = false) {
  return !betaEnabled && capability?.leadLive === true && beatMode === 'capture';
}
