export interface BeatMode {
  version:1;privateCandidate:boolean;mode:'verified-cache'|'live-qualified'|'experimental-buffered'|'experimental-live'|'degraded'|'unsupported';
  support:'supported'|'experimental'|'unsupported'|'policy-blocked';reason:string;bufferReason:string;detectorId:string;detectorVersion:string;
  clockHealthy:boolean;captureHealthy:boolean;allowCapture:boolean;allowAnalysis:boolean;allowSemantic:boolean;allowTypedPreview:boolean;
  bufferEligible:boolean;livePreviewEligible:boolean;livePreviewReason:string;requiredBufferMs:number;bufferMs:number;latencySamples:number;measuredP95Ms:number|null;measuredP99Ms:number|null;
  generation:number;physicalVerified:boolean;
  sourceKind:'audio-only'|'video'|'unknown';outputOwned:boolean;singleSource:boolean;noVideo:boolean;noFrames:boolean;
  droppedSemanticEvents:number;
  earlyDecisionAvailable?:boolean;
  compensationEligible?:boolean;
  hybridLiveAvailable?:boolean;
  hybridMode?:'L0'|'H-SHADOW'|'H-LIVE';
  hybridFailure?:string|null;
}
export interface SyncConfiguration {enabled:boolean;captureId:string;generation:number;intentionalDelay:boolean;outputHeard:boolean;authorizedAudio:boolean;preview:boolean;live?:boolean;latencyAccepted?:boolean;compensationMs?:number;detectorVariant?:'L0'|'L1-gap0'|'H-SHADOW'|'H-LIVE'}
export function parseBeatMode(value:unknown):BeatMode|undefined;
export function validSyncConfiguration(value:unknown):value is SyncConfiguration;
export function decideBeatMode(facts?:Record<string,unknown>,now?:number):BeatMode;
export function bufferRequirement(timing:unknown):number|undefined;
export function verifiedTrackMatches(source:unknown,track:unknown):boolean;
