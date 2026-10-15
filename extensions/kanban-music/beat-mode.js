const modes=new Set(['verified-cache','live-qualified','experimental-buffered','experimental-live','degraded','unsupported']);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const opaque=value=>typeof value==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(value);

export function bufferRequirement(timing) {
  if(!Number.isInteger(timing?.samples)||timing.samples<32
    || !Number.isFinite(timing.p95Ms)||!Number.isFinite(timing.p99Ms)
    || timing.p95Ms<0||timing.p99Ms<timing.p95Ms)return;
  // Fixed headroom covers scheduling jitter; never grow an active buffer.
  const milliseconds=Math.max(80,Math.ceil((timing.p99Ms+40)/10)*10);
  return milliseconds<=500?milliseconds:undefined;
}

export function verifiedTrackMatches(source,track) {
  return Boolean(track?.status==='independently-verified'&&hash(source?.contentSha256)
    &&hash(track.annotationSha256)&&source.id&&source.version
    &&track.sourceId===source.id&&track.sourceVersion===source.version
    &&track.sourceSha256===source.contentSha256&&opaque(track.revision));
}

export function decideBeatMode(facts={},now=Date.now()) {
  const source=facts.source||{},capture=facts.capture||{},clock=facts.clock||{},detector=facts.detector||{};
  const experiment=facts.experiment||{},timing=facts.timing||{};
  const clockHealthy=Number.isFinite(clock.sampledAt)&&now-clock.sampledAt>=-1000&&now-clock.sampledAt<=1500
    &&Number.isSafeInteger(clock.generation)&&clock.generation>=0
    &&Number.isFinite(clock.playbackRate)&&clock.playbackRate>0&&!clock.seeking&&!clock.buffering;
  const captureHealthy=Boolean(opaque(capture.id)&&opaque(capture.owner)&&capture.owner===capture.expectedOwner
    &&capture.active===true&&capture.audible===true);
  const policyBlocked=source.provider==='spotify';
  const privateMode=facts.privateCandidate===true;
  const measuredRequirement=bufferRequirement(timing);
  // Matched private A/B playback uses the existing ceiling, never an escape
  // from calibration: an over-budget measured requirement remains unavailable.
  const requirement=measuredRequirement===undefined?undefined
    :privateMode&&detector.comparisonBufferMs===500?500:measuredRequirement;
  const sourceEligible=privateMode&&!policyBlocked&&source.protectedMedia!==true&&source.kind==='audio-only'
    &&source.singleSource===true&&source.noVideo===true&&source.noFrames===true
    &&facts.surface==='web'&&capture.output==='tab-replacement'&&capture.originalSuppressed===true;
  const bufferEligible=Boolean(sourceEligible&&captureHealthy&&clockHealthy&&clock.playbackRate===1
    &&requirement!==undefined&&detector.privateUseAllowed===true);
  const liveSource=privateMode&&!policyBlocked&&source.protectedMedia!==true&&facts.surface==='web'
    &&['audio-only','video'].includes(source.kind)&&source.singleSource===true
    &&capture.output==='tab-replacement'&&capture.originalSuppressed===true;
  const livePreviewEligible=Boolean(liveSource&&captureHealthy&&clockHealthy&&clock.playing===true&&clock.paused===false&&detector.privateUseAllowed===true);
  const livePreviewReason=livePreviewEligible?'eligible':!liveSource?'source-or-output-unproven':!captureHealthy?'capture-unproven'
    :!clockHealthy?'clock-unreliable':clock.playing!==true||clock.paused!==false?'not-playing':'detector-rights-unavailable';
  const requested=experiment.enabled===true;
  const consent=experiment.intentionalDelay===true&&experiment.outputHeard===true&&experiment.authorizedAudio===true
    &&experiment.captureId===capture.id&&experiment.generation===clock.generation;
  const activeBuffer=Number.isFinite(experiment.bufferMs)&&experiment.bufferMs>=80&&experiment.bufferMs<=500?experiment.bufferMs:0;
  const bufferReason=bufferEligible?'eligible':!sourceEligible?'source-or-output-unproven':!captureHealthy?'capture-unproven'
    :!clockHealthy?'clock-unreliable':clock.playbackRate!==1?'rate-unsupported':requirement===undefined?'calibration-unavailable':'detector-rights-unavailable';
  const result={version:1,privateCandidate:privateMode,mode:'degraded',support:'experimental',reason:'detector-unqualified',bufferReason,
    sourceKind:['audio-only','video'].includes(source.kind)?source.kind:'unknown',
    outputOwned:capture.output==='tab-replacement'&&capture.originalSuppressed===true,
    singleSource:source.singleSource===true,noVideo:source.noVideo===true,noFrames:source.noFrames===true,
    droppedSemanticEvents:Number.isSafeInteger(facts.health?.droppedSemanticEvents)?Math.max(0,facts.health.droppedSemanticEvents):0,
    detectorId:typeof detector.id==='string'?detector.id.slice(0,100):'unavailable',
    detectorVersion:typeof detector.version==='string'?detector.version.slice(0,100):'unknown',
    clockHealthy,captureHealthy,allowCapture:!policyBlocked&&source.protectedMedia!==true,
    allowAnalysis:privateMode&&!policyBlocked&&source.protectedMedia!==true&&detector.privateUseAllowed===true,
    allowSemantic:false,allowTypedPreview:false,bufferEligible,livePreviewEligible,livePreviewReason,requiredBufferMs:requirement||0,bufferMs:0,
    latencySamples:Number.isInteger(timing.samples)?timing.samples:0,
    measuredP95Ms:Number.isFinite(timing.p95Ms)?timing.p95Ms:null,
    measuredP99Ms:Number.isFinite(timing.p99Ms)?timing.p99Ms:null,
    generation:Number.isSafeInteger(clock.generation)?clock.generation:0,physicalVerified:false};
  if(policyBlocked||source.protectedMedia===true)return {...result,mode:'unsupported',support:policyBlocked?'policy-blocked':'unsupported',
    reason:policyBlocked?'provider-policy':'protected-source',bufferEligible:false};
  if(!clockHealthy)return {...result,reason:'clock-unreliable',bufferEligible:false};
  if(verifiedTrackMatches(source,facts.eventTrack))return {...result,mode:'verified-cache',reason:'verified-source',
    allowSemantic:true,support:'experimental',physicalVerified:detector.physicalVerified===true};
  if(!captureHealthy)return {...result,reason:'capture-unproven'};
  if(detector.trained===true&&detector.accuracyQualified===true&&detector.browserBudgetQualified===true
    &&Number.isFinite(detector.endToEndP95Ms)&&detector.endToEndP95Ms<=50)
    return {...result,mode:'live-qualified',reason:'validated-detector',allowSemantic:true,support:'supported',physicalVerified:detector.physicalVerified===true};
  if(requested&&experiment.live===true) {
    const liveConsent=experiment.authorizedAudio===true&&experiment.outputHeard===true&&experiment.latencyAccepted===true
      &&experiment.preview===true&&experiment.captureId===capture.id&&experiment.generation===clock.generation;
    return livePreviewEligible&&liveConsent&&experiment.bufferMs===0
      ?{...result,mode:'experimental-live',reason:'unverified-late-preview',allowTypedPreview:true}
      :{...result,reason:liveConsent?'live-preview-unavailable':'live-consent-required'};
  }
  if(requested&&bufferEligible&&consent&&activeBuffer&&activeBuffer>=requirement)
    return {...result,mode:'experimental-buffered',reason:'unverified-detector-preview',bufferMs:activeBuffer,
      allowTypedPreview:experiment.preview===true};
  if(requested)return {...result,reason:!sourceEligible?'output-not-owned':!consent?'delay-consent-required':'buffer-budget-unavailable'};
  return result;
}

export function parseBeatMode(value) {
  if(!value||value.version!==1||!modes.has(value.mode)||typeof value.reason!=='string'
    ||!['supported','experimental','unsupported','policy-blocked'].includes(value.support))return;
  const result={version:1,mode:value.mode,support:value.support,reason:value.reason.slice(0,100),
    sourceKind:['audio-only','video'].includes(value.sourceKind)?value.sourceKind:'unknown',
    bufferReason:typeof value.bufferReason==='string'?value.bufferReason.slice(0,100):'unavailable',
    livePreviewReason:typeof value.livePreviewReason==='string'?value.livePreviewReason.slice(0,100):'unavailable',
    detectorId:String(value.detectorId||'unavailable').slice(0,100),detectorVersion:String(value.detectorVersion||'unknown').slice(0,100)};
  for(const key of ['privateCandidate','outputOwned','singleSource','noVideo','noFrames','clockHealthy','captureHealthy','allowCapture','allowAnalysis','allowSemantic','allowTypedPreview','bufferEligible','livePreviewEligible','physicalVerified'])
    result[key]=value[key]===true;
  for(const key of ['bufferMs','requiredBufferMs','latencySamples','measuredP95Ms','measuredP99Ms','generation','droppedSemanticEvents'])
    result[key]=Number.isFinite(value[key])&&value[key]>=0?value[key]:key.startsWith('measured')?null:0;
  if(result.bufferMs>500||result.requiredBufferMs>500)return;
  return result;
}

export function validSyncConfiguration(value) {
  return Boolean(value&&typeof value.enabled==='boolean'&&opaque(value.captureId)
    &&Number.isSafeInteger(value.generation)&&value.generation>=0
    &&(value.live===undefined||typeof value.live==='boolean')
    &&(value.latencyAccepted===undefined||typeof value.latencyAccepted==='boolean')
    &&(!value.enabled||value.outputHeard===true&&value.authorizedAudio===true
      &&(value.live===true?value.latencyAccepted===true&&value.preview===true:value.intentionalDelay===true))
    &&typeof value.preview==='boolean');
}
