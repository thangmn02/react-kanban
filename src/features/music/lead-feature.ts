export type LeadRollout = 'disabled' | 'development' | 'private-beta' | 'public';

/** Build controls select the UI audience; the gateway enforces private access. */
export function leadRollout(): LeadRollout {
  if (import.meta.env.DEV) return import.meta.env.VITE_LEAD_PULSE_DEV_ENABLED === 'false'
    ? 'disabled' : 'development';
  if (import.meta.env.VITE_LEAD_PULSE_PUBLIC_ENABLED === 'true') return 'public';
  if (import.meta.env.VITE_LEAD_PULSE_BETA_ENABLED === 'true') return 'private-beta';
  return 'disabled';
}

export function leadPulseEnabled() {
  return leadRollout() !== 'disabled';
}

/** UI activation alone must never authorize audio transfer or remote inference. */
export function leadProcessingEnabled() {
  return leadPulseEnabled() && import.meta.env.VITE_LEAD_PULSE_PROCESSING_ENABLED === 'true';
}

export type LeadAvailability = 'checking' | 'pending' | 'unavailable' | 'failed' | 'blocked' | 'ready' | 'empty';
export function leadAvailabilityText(state?: LeadAvailability) {
  switch (state) {
    case 'pending': return 'analysis pending · playback continues';
    case 'unavailable': return leadProcessingEnabled()
      ? 'analysis unavailable · retrying while playback continues'
      : 'analysis unavailable · new audio analysis is disabled · cached Lead ranges only';
    case 'failed': return 'analysis or cache failed · retrying while playback continues';
    case 'blocked': return 'not available for this account or track · playback continues';
    case 'ready': return 'analyzed events available for this range';
    case 'empty': return 'analyzed range has no confident Lead events';
    default: return 'checking for analyzed Lead events';
  }
}
