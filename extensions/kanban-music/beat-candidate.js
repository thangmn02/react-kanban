// Enabled only in the explicitly packaged private candidate, never by a page.
export const privateBeatCandidate = false;
export const semanticPrecisionGuards = Object.freeze({mode:'off'});
export const privateHatLabelMapping = 'off';
export const privatePercussionDiagnostics = false;
export const privatePercussionClassifier = 'onset-guided';
export const candidateVersion = 'browser-first-v1';
export const candidateDetector = Object.freeze({ id:'adtof-onset-valley',version:'1',
  hybridLiveAvailable:false,
  earlyDecisionAvailable:false,
  comparisonBufferMs:0,
  trained:true,causal:false,privateUseAllowed:true,accuracyQualified:false,
  browserBudgetQualified:false,physicalVerified:false });
