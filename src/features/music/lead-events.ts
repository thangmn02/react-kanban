// Keep the wire row named melody for compatibility; the product semantic is Lead.
export const LEAD_POLICY_VERSION = 'lead-pulse-v1';
export const LEAD_ANALYSIS_VERSION = 'server-lead-pulse-range-v1';

export interface LeadProvenance {
  policyVersion: typeof LEAD_POLICY_VERSION;
  source: 'vocals' | 'piano' | 'guitar' | 'other';
  kind: 'vocal-articulation' | 'pitched-note';
  detector: 'melodia' | 'vocal-body-articulation';
  inputSha256: string;
  midiPitch?: number;
}

export function parseLeadProvenance(value: unknown): LeadProvenance | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;

  const provenance = value as LeadProvenance;
  if (
    provenance.policyVersion !== LEAD_POLICY_VERSION
    || !['vocals', 'piano', 'guitar', 'other'].includes(provenance.source)
    || !['vocal-articulation', 'pitched-note'].includes(provenance.kind)
    || !/^[a-f0-9]{64}$/.test(provenance.inputSha256)
    || provenance.kind === 'vocal-articulation'
      && (provenance.source !== 'vocals' || provenance.detector !== 'vocal-body-articulation')
    || provenance.kind === 'pitched-note' && provenance.detector !== 'melodia'
    || provenance.midiPitch !== undefined
      && (!Number.isFinite(provenance.midiPitch) || provenance.midiPitch < 0 || provenance.midiPitch > 127)
  ) return;

  return {
    policyVersion: provenance.policyVersion,
    source: provenance.source,
    kind: provenance.kind,
    detector: provenance.detector,
    inputSha256: provenance.inputSha256,
    ...(provenance.midiPitch !== undefined ? { midiPitch: provenance.midiPitch } : {}),
  };
}
