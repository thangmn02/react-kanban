import { mediaAssetFromUrl, parseMediaAsset } from './media-asset.js';
import { LEAD_AUDIO_VERSION } from './lead-audio-tap.js';

// Separate from Chrome's tabCapture grant. This short-lived operator scope is
// required before any raw samples can leave the offscreen document.
export function authorizedLeadAudio(scope, session, sender, now = Date.now()) {
  let origin;
  try { origin = new URL(sender.url).origin; } catch { return false; }
  const expected = parseMediaAsset(scope?.asset), actual = parseMediaAsset(session?.asset);
  if (expected?.provider !== 'kora-development'
    || !mediaAssetFromUrl(session?.src, scope) || session.src !== scope.sourceUrl) return false;
  return ['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin)
    && !sender.native && scope?.analysisVersion === LEAD_AUDIO_VERSION
    && Number.isFinite(scope.expiresAt) && scope.expiresAt > now && scope.expiresAt <= now + 3600000
    && Boolean(expected && actual && expected.provider === actual.provider && expected.id === actual.id);
}
