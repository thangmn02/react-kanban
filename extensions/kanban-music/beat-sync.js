const offscreenPath = 'offscreen.html';
import { beatTelemetry, parseBeatTraces } from './beat-telemetry.js';
import { audibleClock, playbackTiming, playbackTraces, parsePlaybackClock, clockDiscontinuity, sameSourceFence } from './beat-timing.js';
import { privateBeatCandidate, candidateDetector } from './beat-candidate.js';
import { decideBeatMode, validSyncConfiguration } from './beat-mode.js';
import {validDiagnosticRequest} from './protocol.js';
import {parseMediaAsset} from './media-asset.js';
const telemetry = beatTelemetry.at('beat-sync');
const validBands = new Set(['kick', 'bass', 'clap', 'hat']);
const sameOwner = (a, b) => a.native === b.native && a.tabId === b.tabId && a.documentId === b.documentId;
const telemetryEnabled = current => beatTelemetry.enabled || current.diagnostics === true;
function captureError(failure) {
  if (['audio-context', 'stream-open', 'audio-graph', 'audio-resume', 'offscreen-response'].includes(failure?.stage)
    && ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'AbortError', 'OverconstrainedError', 'SecurityError', 'InvalidStateError', 'TypeError', 'Error', 'TransportError', 'TimeoutError', 'UnavailableError'].includes(failure?.code)) {
    return { stage: failure.stage, code: failure.code };
  }
}
function captureFailure(stage, error) {
  if (stage !== 'capture-permission') return stage;
  const message = String(error?.message || '');
  if (/permission|denied|not (?:been )?invoked|activeTab|not allowed/i.test(message)) return 'capture-permission';
  if (/already|in use|being captured/i.test(message)) return 'capture-busy';
  return 'capture-request';
}
const timeout = (promise, ms) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), ms); })]).finally(() => clearTimeout(timer));
};

export function createBeatSync(api, nativePublish) {
  let state;
  let creating;
  let queue = Promise.resolve();
  let sourceRevision=0;
  let diagnosticSession,diagnosticTimer;
  const stopDiagnosticInstrumentation=current=>{
    if(!diagnosticSession?.instrumentationActive)return;
    clearTimeout(diagnosticTimer);diagnosticSession.instrumentationActive=false;
    current.diagnostics=diagnosticSession.priorCurrentDiagnostics;beatTelemetry.enable(diagnosticSession.priorTelemetry);
    void offscreenMessage({kind:'diagnostic-capture',operation:'status',recordingId:diagnosticSession.recordingId,captureId:diagnosticSession.captureId}).catch(()=>{});
  };
  const serialize = (fn) => { queue = queue.catch(() => {}).then(fn); return queue; };
  const offscreenMessage = (message) => api.runtime.sendMessage({ target: 'beat-offscreen', ...message });
  const fence=current=>{
    if(current.revisionEpoch!==current.synchronizationEpoch){current.revisionEpoch=current.synchronizationEpoch;sourceRevision=Math.max(sourceRevision+1,Date.now()*1000);current.sourceRevision=sourceRevision;}
    return {sourceId:current.session.id,sourceGeneration:current.clock?.generation||0,synchronizationEpoch:current.synchronizationEpoch,sourceRevision:current.sourceRevision};
  };
  const fencedClock=current=>({...current.clock,generation:current.clock?.generation||0,...fence(current)});
  const modeFacts = current => ({privateCandidate:privateBeatCandidate,surface:current.owner.native?'desktop':'web',
    source:{...(current.clock?.mediaFacts||current.session.mediaFacts||{kind:'unknown'}),
      id:current.session.id,version:current.session.src,
      provider:current.session.asset?.provider||(current.session.source==='open.spotify.com'?'spotify':'other'),
      protectedMedia:current.clock?.protectedMedia===true||current.session.protectedMedia===true},
    capture:{id:current.captureId,owner:current.token,expectedOwner:current.token,
      active:current.captureReady===true,audible:current.audioDetected===true,
      output:current.owner.native?'native-monitor':'tab-replacement',originalSuppressed:current.captureReady===true&&current.originalSuppressed===true&&!current.owner.native},
    clock:{...current.clock,generation:current.clock?.generation||0},
    detector:current.experiment?.enabled&&['H-SHADOW','H-LIVE'].includes(current.experiment.detectorVariant)
      ?{...candidateDetector,id:'hybrid-adtof-cnn-running',version:current.experiment.detectorVariant}
      :current.experiment?.enabled&&current.experiment?.detectorVariant==='L1-gap0'
        ?{...candidateDetector,id:'adtof-early-finalization',version:'L1-gap0'}:candidateDetector,
    timing:current.experiment?.enabled&&!current.experiment.live?current.experiment.calibration:current.calibration||{},health:current.health||{},experiment:current.experiment||{}});
  const capability = current => privateBeatCandidate?decideBeatMode(modeFacts(current)):undefined;
  const pauseRetainsCapture = current => privateBeatCandidate&&current.captureReady&&current.audioDetected
    &&!current.owner.native&&(current.clock?.mediaFacts?.kind==='audio-only'&&current.clock.mediaFacts.noVideo===true
      ||capability(current).compensationEligible);

  function clockReason(current) {
    if (current.mode === 'capture') return undefined;
    if (!current.clock?.playing) return 'not-playing';
    if (current.clock.muted || current.tabMuted) return 'muted';
    return current.fallbackReason || (current.captureId ? 'starting' : 'clock');
  }

  function publishState(current) {
    publish(current, { kind: 'sync.state', mode: current.mode, reason: clockReason(current), captureId: current.mode === 'capture' ? current.captureId : undefined,
      ...(privateBeatCandidate?{capability:capability(current)}:{}) });
  }

  function revokeLivePreview(current,trigger) {
    if(!current.experiment?.live)return;
    const mode=capability(current),clock=current.clock||{};
    telemetry.record('PREVIEW_REVOKED',undefined,{captureId:current.captureId,trigger,previewReason:mode.livePreviewReason,
      generation:clock.generation||0,clockAgeMs:Date.now()-clock.sampledAt,playing:clock.playing,paused:clock.paused,seeking:clock.seeking,buffering:clock.buffering,
      captureHealthy:mode.captureHealthy,clockHealthy:mode.clockHealthy,outputOwned:mode.outputOwned,singleSource:mode.singleSource});
    current.experiment=undefined;current.synchronizationEpoch=crypto.randomUUID();
    void offscreenMessage({kind:'synchronization',captureId:current.captureId,
      settings:{bufferMs:0,eligible:false,allowTypedPreview:false,live:true,flush:true,epoch:current.synchronizationEpoch}}).catch(()=>{});
    publishState(current);
  }

  function confirmCapture(current) {
    if (state !== current || !current.captureId || !current.captureReady || !current.audioDetected
      || !current.clock?.playing || current.clock.muted || current.tabMuted) return;
    current.mode = 'capture';
    telemetry.record('AUDIO_DETECTED', undefined, { captureId: current.captureId });
    if (current.recoveryReason) {
      telemetry.record('CAPTURE_RECOVERED', undefined, { captureId: current.captureId, reason: current.recoveryReason });
      current.recoveryReason = undefined;
    }
    current.fallbackReason = undefined;
    publishState(current);
  }

  function publish(current, event) {
    if (state !== current) { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return; }
    telemetry.mark('EVENT_SENT', event.telemetry);
    event = { ...event, ...fence(current), emittedAt: Date.now() };
    if (current.owner.native) {
      nativePublish?.(current.owner.native, { sessionId: current.session.id, subscriptionId: current.subscriptionId, ...event });
      return;
    }
    void api.tabs.sendMessage(current.owner.tabId, { protocol: 'kanban-music-v1', event: 'beat',
      sessionId: current.session.id, subscriptionId: current.subscriptionId, ...event },
    { documentId: current.owner.documentId }).catch(() => { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'transport' }); void stopIfCurrent(current,'transport'); });
  }

  async function ensureOffscreen() {
    if (creating) return creating;
    creating = (async () => {
      const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL(offscreenPath)] });
      if (!contexts.length) await api.offscreen.createDocument({ url: offscreenPath, reasons: ['USER_MEDIA'],
        justification: 'Analyze the selected music tab locally for beat lighting and preserve its audible playback.' });
    })();
    try { await creating; } finally { creating = undefined; }
  }

  function cancelCapture(current) {
    stopDiagnosticInstrumentation(current);
    const captureId = current.captureId;
    if (!captureId && current.mode === 'clock') return;
    telemetry.record('CAPTURE_STOP', undefined, { captureId, reason: current.fallbackReason || 'stopped' });
    current.captureId = undefined;
    current.captureReady = false;
    current.audioDetected = false;
    current.delaySeconds = 0;
    current.experiment = undefined;
    current.synchronizationEpoch=crypto.randomUUID();
    current.calibration = undefined;
    current.originalSuppressed = false;
    current.mode = 'clock';
    publishState(current);
    if (captureId) current.stopTask=Promise.all([current.stopTask,
      timeout(offscreenMessage({ kind: 'stop', captureId }),1500)]).then(([prior,response])=>prior!==false&&response?.ok===true,()=>false);
  }

  async function capture(current, force = false) {
    if (current.owner.nativeAudio) { current.fallbackReason = 'native-audio'; publishState(current); return; }
    if (state !== current) return;
    if (privateBeatCandidate && !capability(current).allowCapture) { current.fallbackReason='provider-policy'; publishState(current); return; }
    // Every allowlisted service uses the same browser-approved tab stream.
    // A host name or mediaKeys flag is not evidence that output is silent.
    // Only audible analyser proof can confirm capture; browser restrictions
    // and genuinely silent streams still fall back without fabricated beats.
    if (state !== current || current.captureTask || current.captureId || !current.clock?.playing
      || current.clock.muted || current.tabMuted
      || (!force && Date.now() < current.retryAt)) return;
    const captureId = crypto.randomUUID();
    current.captureId = captureId;
    current.synchronizationEpoch=crypto.randomUUID();
    telemetry.record('CAPTURE_START', undefined, { captureId });
    current.captureReady = false;
    current.audioDetected = false;
    current.sequence = 0;
    current.fallbackReason = undefined;
    publishState(current);
    current.captureTask = (async () => {
      let stage = 'offscreen-create';
      try {
        if(await current.stopTask===false) {
          const closed=await timeout(api.offscreen.closeDocument(),1000).then(()=>true,()=>false);
          if(!closed)throw new Error('Previous capture cleanup unavailable');
          current.stopTask=Promise.resolve(true);
        }
        if(state!==current||current.captureId!==captureId)return;
        await ensureOffscreen();
        if (state !== current || current.captureId !== captureId) return;
        stage = 'capture-permission';
        const streamId = await api.tabCapture.getMediaStreamId({ targetTabId: current.session.tabId });
        if (state !== current || current.captureId !== captureId) return;
        stage = 'capture-stream';
        const response = await timeout(offscreenMessage({ kind: 'start', captureId, streamId, telemetryEnabled: telemetryEnabled(current),
          ...fence(current),
          ...(privateBeatCandidate?{candidate:true,sourceProvider:modeFacts(current).source.provider}: {}) }), 4500);
        if (state !== current || current.captureId !== captureId) {
          void offscreenMessage({ kind: 'stop', captureId }).catch(() => {}); return;
        }
        if (!response?.ok) {
          current.captureError = captureError(response?.captureError);
          throw new Error('Capture unavailable');
        }
        current.captureError = undefined;
        current.delaySeconds = Number.isFinite(response.delaySeconds) && response.delaySeconds >= 0 && response.delaySeconds <= 5 ? response.delaySeconds : 0;
        current.captureReady = true;
        if(privateBeatCandidate) {
          const captures=await api.tabCapture.getCapturedTabs().catch(()=>[]);
          if(state!==current||current.captureId!==captureId)return;
          current.originalSuppressed=captures.some(item=>item.tabId===current.session.tabId&&item.status==='active');
        }
        // An open stream can still be silent/protected. Wait for analyser proof.
        confirmCapture(current);
      } catch (error) {
        if (state === current && current.captureId === captureId) {
          if (stage === 'capture-stream' && !current.captureError) {
            const message = String(error?.message || '');
            current.captureError = { stage: 'offscreen-response', code: /timeout/i.test(message) ? 'TimeoutError'
              : /receiving end|connection|port.*closed/i.test(message) ? 'TransportError' : 'UnavailableError' };
          }
          const reason = captureFailure(stage, error);
          current.retryAt = Date.now() + (reason === 'capture-permission' ? 30000 : 3000);
          current.fallbackReason = reason;
          cancelCapture(current);
        }
      } finally { current.captureTask = undefined; }
    })();
    await current.captureTask;
  }

  async function stopCurrent(keepOffscreen = false,reason='stopped') {
    const previous = state;
    if(previous)stopDiagnosticInstrumentation(previous);
    state = undefined;
    let released=true;
    if (previous) {
      telemetry.record('CAPTURE_STOP',undefined,{captureId:previous.captureId,reason});
      void api.tabs.sendMessage(previous.session.tabId, { target: 'beat-clock', kind: 'stop', token: previous.token },
        { documentId: previous.session.documentId }).catch(() => {});
      if (previous.captureId) released=(await timeout(offscreenMessage({ kind: 'stop', captureId: previous.captureId }), 1000).catch(() => undefined))?.ok===true;
      if(await previous.stopTask===false)released=false;
    }
    // A handoff releases the entire old stream/graph, but can reuse the empty document.
    if (keepOffscreen&&released) return true;
    // Also clean up an orphan left by a restarted service worker.
    if (creating) await timeout(creating, 4500).catch(() => {});
    const closed=await timeout(api.offscreen.closeDocument(), 1000).then(()=>true,()=>false);
    return released||closed;
  }

  function stopIfCurrent(current,reason='stopped') {
    // Revoke admission immediately, before serialized cleanup can await another task.
    if(state===current)cancelCapture(current);
    return serialize(async () => { if (state === current) await stopCurrent(false,reason); });
  }

  function stop(owner, subscriptionId) {
    return serialize(async () => {
      if (owner && (!state || !sameOwner(state.owner, owner) || subscriptionId !== undefined && state.subscriptionId !== subscriptionId)) return;
      await stopCurrent();
    });
  }

  async function startClock(current) {
    const target = { documentId: current.session.documentId };
    const message = { target: 'beat-clock', kind: 'watch', index: current.session.index, src: current.session.src,
      observed: current.session.observed, token: current.token };
    let result;
    try { result = await timeout(api.tabs.sendMessage(current.session.tabId, message, target), 1500); }
    catch {
      await api.scripting.executeScript({ target: { tabId: current.session.tabId, documentIds: [current.session.documentId] }, files: ['clock.js'] });
      result = await timeout(api.tabs.sendMessage(current.session.tabId, message, target), 1500);
    }
    return result?.ok === true;
  }

  return {
    status(session) {
      if (state?.session.id === session.id) return { mode: state.mode, reason: clockReason(state),
        ...(state.captureError ? { captureError: { ...state.captureError } } : {}),
        ...(state.mode === 'capture' || privateBeatCandidate&&state.captureId ? { captureId: state.captureId } : {}),
        ...(privateBeatCandidate?{capability:capability(state)}:{}) };
      return { mode: 'clock', reason: !session.playing ? 'not-playing'
        : session.muted || session.tabMuted ? 'muted' : 'not-selected' };
    },
    start(session, owner, subscriptionId, diagnostics = false) {
      if(state&&(state.session.id!==session.id||state.session.src!==session.src||!sameOwner(state.owner,owner)))cancelCapture(state);
      return serialize(async () => {
        if (state && sameOwner(state.owner, owner) && state.owner.nativeAudio === owner.nativeAudio
          && state.subscriptionId === subscriptionId && state.session.id === session.id && state.session.src === session.src) {
          const current = state;
          current.diagnostics = diagnostics === true;
          current.tabMuted = session.tabMuted;
          const lease = await timeout(api.tabs.sendMessage(session.tabId, { target: 'beat-clock', kind: 'lease', token: current.token },
            { documentId: session.documentId }), 1500).catch(() => {});
          if (!lease?.ok) await startClock(current).catch(() => {});
          if (current.captureId && current.captureReady) {
            const captureId = current.captureId;
            const captureLease = await timeout(offscreenMessage({ kind: 'lease', captureId, telemetryEnabled: telemetryEnabled(current) }), 1000).catch(() => undefined);
            if(privateBeatCandidate&&captureLease?.calibration)current.calibration=captureLease.calibration;
            if(privateBeatCandidate&&captureLease?.health)current.health=captureLease.health;
            if(privateBeatCandidate&&!current.owner.native) {
              const captures=await api.tabCapture.getCapturedTabs().catch(()=>[]);
              if(state!==current||current.captureId!==captureId)return;
              current.originalSuppressed=captures.some(item=>item.tabId===current.session.tabId&&item.status==='active');
            }
            telemetry.record(captureLease?.ok ? 'LEASE_RENEW' : 'LEASE_EXPIRED', undefined, { captureId });
            if (!captureLease?.ok && current.captureId === captureId) {
              current.retryAt = 0;
              current.fallbackReason = 'capture-disconnected';
              current.recoveryReason = current.fallbackReason;
              cancelCapture(current);
            }
          }
          if (current.tabMuted) cancelCapture(current);
          else void capture(current);
          if(current.experiment?.live&&!capability(current).livePreviewEligible)revokeLivePreview(current,'renewal');
          publishState(current);
          return;
        }
        if(state)telemetry.record('CAPTURE_REPLACED',undefined,{captureId:state.captureId,sameOwner:sameOwner(state.owner,owner),sameNativeAudio:state.owner.nativeAudio===owner.nativeAudio,sameSubscription:state.subscriptionId===subscriptionId,sameSession:state.session.id===session.id,sameSource:state.session.src===session.src});
        if(!await stopCurrent(true,'replaced'))throw new Error('Previous audio ownership could not be released');
        const current = { owner, session, subscriptionId, synchronizationEpoch:crypto.randomUUID(),diagnostics: diagnostics === true, token: crypto.randomUUID(), mode: 'clock', retryAt: 0,
          tabMuted: session.tabMuted, clock: session };
        state = current;
        publishState(current);
        try {
          if (!await startClock(current)) throw new Error('Clock unavailable');
          void capture(current);
        } catch { if (state === current) await stopCurrent(false,'clock-disconnected'); }
      });
    },
    stop,
    configure(session,owner,configuration) {
      return serialize(async()=>{
        const current=state;
        if(!privateBeatCandidate||!current||!sameOwner(current.owner,owner)||owner.native
          ||current.session.id!==session.id||current.session.src!==session.src
          ||!validSyncConfiguration(configuration)||configuration.captureId!==current.captureId
          ||configuration.generation!==(current.clock?.generation||0)
          ||configuration.detectorVariant==='L1-gap0'&&candidateDetector.earlyDecisionAvailable!==true
          ||['H-SHADOW','H-LIVE'].includes(configuration.detectorVariant)&&candidateDetector.hybridLiveAvailable!==true
          ||['H-SHADOW','H-LIVE'].includes(configuration.detectorVariant)&&current.clock?.playbackRate!==1
          ||configuration.live&&current.delaySeconds>0||configuration.enabled&&current.clock?.playing&&!configuration.live
          ||current.clock?.seeking||current.clock?.buffering) return false;
        const available=capability(current);
        if(configuration.enabled&&(configuration.live?!available.livePreviewEligible||!current.clock?.playing
          :configuration.compensationMs!==undefined?!available.compensationEligible:!available.bufferEligible))return false;
        const experiment={...configuration,bufferMs:configuration.enabled&&!configuration.live?configuration.compensationMs??available.requiredBufferMs:0,
          calibration:{...current.calibration}};
        const next=decideBeatMode({...modeFacts(current),experiment});
        const expectedMode=configuration.live?'experimental-live':'experimental-buffered';
        if(configuration.enabled&&next.mode!==expectedMode)return false;
        const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
        publishState(current);
        const result=await timeout(offscreenMessage({kind:'synchronization',captureId:current.captureId,
          settings:{bufferMs:next.bufferMs,allowTypedPreview:next.allowTypedPreview,eligible:next.mode===expectedMode,
            paused:!current.clock?.playing,live:configuration.live===true,flush:!configuration.enabled,epoch,
            detectorVariant:configuration.enabled?configuration.detectorVariant||'L0':'L0'}}),1500).catch(()=>undefined);
        if(state!==current||result?.ok!==true||current.captureId!==configuration.captureId||current.synchronizationEpoch!==epoch
          ||configuration.enabled&&current.clock?.playing&&!configuration.live
          ||configuration.enabled&&configuration.live&&!current.clock?.playing
          ||configuration.generation!==(current.clock?.generation||0)
          ||configuration.enabled&&decideBeatMode({...modeFacts(current),experiment}).mode!==expectedMode) {
          if(state!==current||current.captureId!==configuration.captureId||current.synchronizationEpoch!==epoch)return false;
          const rollbackEpoch=crypto.randomUUID();current.synchronizationEpoch=rollbackEpoch;
          current.experiment=undefined;current.delaySeconds=0;publishState(current);
          const rollback=await timeout(offscreenMessage({kind:'synchronization',captureId:configuration.captureId,
            settings:{bufferMs:0,eligible:false,allowTypedPreview:false,flush:true,live:configuration.live===true,
              epoch:rollbackEpoch}}),1500).catch(()=>undefined);
          if(state===current&&current.synchronizationEpoch===rollbackEpoch&&rollback?.ok!==true)cancelCapture(current);
          return false;
        }
        current.experiment=experiment;current.delaySeconds=next.bufferMs/1000;
        publish(current,{kind:'clock',clock:audibleClock(fencedClock(current),current.delaySeconds)});
        publishState(current);return true;
      });
    },
    async diagnostics(session,owner,request){
      const current=state;
      if(!privateBeatCandidate||!validDiagnosticRequest(request)||owner.native||!current
        ||!sameOwner(current.owner,owner)||current.session.id!==session.id||current.session.src!==session.src
        ||!current.captureId||current.mode!=='capture')return {ok:false,error:'unavailable'};
      const initialFence=fence(current),captureId=current.captureId;
      if(request.operation!=='start'&&(!diagnosticSession||diagnosticSession.recordingId!==request.recordingId
        ||diagnosticSession.captureId!==captureId||!sameSourceFence(diagnosticSession,initialFence)))return {ok:false,error:'source-changed'};
      const result=await timeout(offscreenMessage({kind:'diagnostic-capture',operation:request.operation,recordingId:request.recordingId,captureId,
        ...(request.durationSeconds!==undefined?{durationSeconds:request.durationSeconds}:{})}),2500).catch(()=>undefined);
      if(state!==current||current.captureId!==captureId||!sameSourceFence(initialFence,fence(current))){
        if(request.operation==='start')void offscreenMessage({kind:'diagnostic-capture',operation:'stop',recordingId:request.recordingId,captureId}).catch(()=>{});
        return {ok:false,error:'source-changed'};
      }
      if(result?.ok!==true||result.recording?.id!==request.recordingId
        ||result.recording?.meta?.captureId!==captureId||!Number.isFinite(result.recording.startedAt)
        ||!sameSourceFence(initialFence,result.recording.meta))return {ok:false,error:result?.error||'diagnostics-unavailable'};
      if(request.operation==='start'){
        stopDiagnosticInstrumentation(current);
        const asset=parseMediaAsset(current.session.asset);
        diagnosticSession={recordingId:request.recordingId,captureId,...initialFence,asset,
          videoId:asset?.provider==='youtube'?asset.id:null,startedAt:Date.now(),clockOverflow:0,
          clocks:[],decisions:[],decisionOverflow:0,instrumentationActive:true,priorCurrentDiagnostics:current.diagnostics===true,priorTelemetry:beatTelemetry.enabled,
          configuration:{capability:capability(current),playbackRate:current.clock?.playbackRate,
            concurrentHybridOwner:'NOT_OBSERVED_BY_COMPANION',physicalVerified:false}};
        current.diagnostics=true;beatTelemetry.enable();
        const endsAt=Number.isFinite(result.recording.endsAt)?result.recording.endsAt:result.recording.startedAt+(request.durationSeconds??30)*1000;
        diagnosticTimer=setTimeout(()=>stopDiagnosticInstrumentation(current),Math.max(0,endsAt+1000-Date.now()));
      }
      if(diagnosticSession.clocks.length<2000)diagnosticSession.clocks.push({at:Date.now(),clock:parsePlaybackClock(fencedClock(current)),delaySeconds:current.delaySeconds});else diagnosticSession.clockOverflow++;
      if(request.operation==='stop'||result.recording.status!=='RECORDING')stopDiagnosticInstrumentation(current);
      const packet={...result,source:{...diagnosticSession,...(request.operation==='read'?{}:{clocks:undefined,decisions:undefined})}};
      return packet;
    },
    async readAudio(session, owner, subscriptionId) {
      const current = state;
      if (!current || !sameOwner(current.owner, owner) || current.subscriptionId !== subscriptionId
        || current.session.id !== session.id || current.session.documentId !== session.documentId
        || current.session.src !== session.src || current.mode !== 'capture' || !current.captureId
          || current.session.asset?.provider !== session.asset?.provider || current.session.asset?.id !== session.asset?.id
          || !current.clock?.playing || current.clock.paused || current.clock.seeking || current.clock.buffering
          || current.clock.muted || current.tabMuted || current.clock.playbackRate !== 1
        || Date.now() - current.clock.sampledAt > 1500) return;
      const captureId = current.captureId, readFence=fence(current);
      const result = await timeout(offscreenMessage({ kind: 'audio.read', captureId }), 800).catch(() => undefined);
        if (state !== current || current.captureId !== captureId || !sameSourceFence(readFence,fence(current)) || !current.clock?.playing
          || current.clock.paused || current.clock.seeking || current.clock.buffering || current.clock.muted
          || current.tabMuted || current.clock.playbackRate !== 1 || Date.now() - current.clock.sampledAt > 1500) return;
      const packet = result?.packet;
      if(packet.sourceId!==undefined&&!sameSourceFence(fence(current),packet))return;
      const timing = playbackTiming(fencedClock(current), packet);
      if (!timing || !Number.isSafeInteger(packet.sequence) || packet.sequence <= 0 || packet.sampleRate !== 44100
        || typeof packet.pcm !== 'string' || packet.pcm.length !== 23520
        || Date.now() - packet.targetOutputTime > 500 || packet.targetOutputTime > Date.now() + 100) return;
      return { pcm: packet.pcm, sequence: packet.sequence, captureId, asset: session.asset,
        clock: { ...timing.playbackClock, currentTime: timing.targetPlaybackTime, sampledAt: packet.targetOutputTime } };
    },
    clock(message, sender) {
      const current = state;
      if (!current || sender.tab?.id !== current.session.tabId || sender.documentId !== current.session.documentId || message.token !== current.token) return;
      if (!message.valid) { publish(current, { kind: 'clock', clock: { ...current.clock, playing: false, paused: true } }); void stopIfCurrent(current,'track-changed'); return; }
      const clock = message.clock;
      if (!parsePlaybackClock(clock) || current.clock && clock.sampledAt < current.clock.sampledAt) return;
      const resumed = (!current.clock?.playing || current.clock?.muted) && clock.playing && !clock.muted;
      const previous = current.clock;
      const diagnostic=diagnosticSession?.instrumentationActive&&diagnosticSession.captureId===current.captureId?diagnosticSession:undefined;
      const before={delay:current.delaySeconds||0,epoch:current.synchronizationEpoch,mode:current.experiment?.detectorVariant||'L0'};
      const discontinuity = clockDiscontinuity(previous, clock)
        || previous?.playing && clock.playing && previous.playbackRate !== clock.playbackRate;
      current.clock = clock;
      if(diagnosticSession?.instrumentationActive&&diagnosticSession.captureId===current.captureId&&sameSourceFence(diagnosticSession,fence(current))){
        if(diagnosticSession.clocks.length<2000)diagnosticSession.clocks.push({at:Date.now(),clock:parsePlaybackClock(fencedClock(current)),delaySeconds:current.delaySeconds});else diagnosticSession.clockOverflow++;
      }
      telemetry.record('EVENT_RECEIVED', undefined, { captureId: current.captureId });
      if (resumed) current.retryAt = 0;
      if (discontinuity) { current.retryAt = 0; cancelCapture(current); }
      if(privateBeatCandidate&&current.experiment?.live&&(!clock.playing||!capability(current).livePreviewEligible))revokeLivePreview(current,'clock');
      const bufferAllowed=privateBeatCandidate&&(current.experiment?.compensationMs!==undefined?capability(current).compensationEligible:capability(current).bufferEligible);
      const decisionFacts=diagnostic?decideBeatMode({...modeFacts(current),diagnostics:true}):undefined;
      let decisionReason=discontinuity?'clock-discontinuity':bufferAllowed?'eligible':'prerequisite-invalid';
      if(privateBeatCandidate&&current.delaySeconds&&((!clock.playing&&previous?.playing)||!bufferAllowed)) {
        const facts=capability(current);
        telemetry.record('COMPENSATION_REVOKED',undefined,{captureId:current.captureId,synchronizationEpoch:current.synchronizationEpoch,
          sourceGeneration:clock.generation||0,configuredAudioDelayMs:current.delaySeconds*1000,
          trigger:'clock',clockAgeMs:Date.now()-clock.sampledAt,playing:clock.playing,paused:clock.paused,seeking:clock.seeking,buffering:clock.buffering,
          captureHealthy:facts.captureHealthy,clockHealthy:facts.clockHealthy,outputOwned:facts.outputOwned,singleSource:facts.singleSource,
          compensationEligible:facts.compensationEligible});
        // Empty the old DelayNode on pause/unsafe source changes. A fresh node
        // retains the fixed delay only for the same paused, eligible source.
        const retain=!clock.playing&&bufferAllowed&&pauseRetainsCapture(current);
        decisionReason=retain?'paused-route-flush-retain':!clock.playing?'playback-stopped':facts.clockHealthy?'source-capture-output-ineligible':'clock-unreliable';
        const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
        void timeout(offscreenMessage({kind:'synchronization',captureId:current.captureId,
          settings:{bufferMs:retain?current.delaySeconds*1000:0,allowTypedPreview:retain&&current.experiment?.preview===true,
            eligible:retain,paused:!clock.playing,flush:true,epoch,detectorVariant:retain?current.experiment?.detectorVariant:'L0'}}),1500).then(result=>{
              if(state===current&&current.synchronizationEpoch===epoch&&result?.ok!==true)cancelCapture(current);
            },()=>{if(state===current&&current.synchronizationEpoch===epoch)cancelCapture(current);});
        if(!retain){current.delaySeconds=0;current.experiment=undefined;}
      }
      if(privateBeatCandidate&&resumed&&current.delaySeconds>0&&bufferAllowed) {
        decisionReason='resume-clean-route';
        const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
        void timeout(offscreenMessage({kind:'synchronization',captureId:current.captureId,
          settings:{bufferMs:current.delaySeconds*1000,allowTypedPreview:current.experiment?.preview===true,
            eligible:true,paused:false,resume:true,flush:true,epoch,detectorVariant:current.experiment?.detectorVariant}}),1500).then(result=>{
              if(state===current&&current.synchronizationEpoch===epoch&&result?.ok!==true)cancelCapture(current);
            },()=>{if(state===current&&current.synchronizationEpoch===epoch)cancelCapture(current);});
      }
      if(diagnostic){
        const row={decisionTime:Date.now(),performanceNow:performance.now(),timeOrigin:performance.timeOrigin,
          clockDomain:'epoch-ms and background performance-ms',captureId:current.captureId,sourceId:current.session.id,
          sourceGeneration:clock.generation,previousEpoch:before.epoch,resultingEpoch:current.synchronizationEpoch,
          previousCompensation:before.delay*1000,requestedCompensation:current.experiment?.compensationMs??0,
          effectiveCompensation:(current.delaySeconds||0)*1000,decisionReason,resultingMode:current.experiment?.detectorVariant||'L0',
          ...decisionFacts.prerequisites,mediaProgressHealthy:null,mediaProgressStatus:'Correlate independently sampled media clock; no policy progress estimator',
          previousClock:parsePlaybackClock(previous),clock:parsePlaybackClock(clock),discontinuity:Boolean(discontinuity)};
        if(diagnostic.decisions.length<2048)diagnostic.decisions.push(row);else diagnostic.decisionOverflow++;
      }
      publish(current, { kind: 'clock', clock: audibleClock(fencedClock(current), clock.playing ? current.delaySeconds || 0 : 0) || clock });
      if ((!clock.playing&&!pauseRetainsCapture(current)) || clock.muted || current.tabMuted) cancelCapture(current);
      else void capture(current);
    },
    offscreen(message, sender) {
      const current = state;
      const trace = parseBeatTraces(message.telemetry);
      if (sender.url !== api.runtime.getURL(offscreenPath) || sender.tab || !current || message.captureId !== current.captureId) { telemetry.mark('EVENT_DROPPED', trace, { reason: 'owner' }); return; }
      if(['onset','tempo.state','tempo.tick'].includes(message.kind)
        && (message.sourceId!==undefined&&!sameSourceFence(fence(current),message)
          ||privateBeatCandidate&&message.synchronizationEpoch!==current.synchronizationEpoch)) {
        telemetry.mark('EVENT_DROPPED',trace,{reason:'owner'});return;
      }
      telemetry.mark('EVENT_RECEIVED', trace);
      // Carry only the allowlisted diagnostic envelope. Beat validation below
      // remains independent of telemetry validity or whether tracing is enabled.
      const timing = playbackTiming(fencedClock(current), message, current.delaySeconds || 0);
      const mapped = playbackTraces(trace, timing, message.targetOutputTime);
      const diagnostic = { ...(mapped ? { telemetry: mapped } : {}), ...(timing || {}) };
      let delivered = false;
      if (message.kind === 'audible') {
        current.audioDetected = true;
        confirmCapture(current);
      }
      if (message.kind === 'onset' && current.mode === 'capture' && current.clock?.playing
        && Array.isArray(message.bands) && message.bands.length <= 4 && message.bands.every((band) => validBands.has(band))) {
        delivered = true;
        const permission=capability(current);
        if(!privateBeatCandidate||(permission.allowSemantic||permission.allowTypedPreview)
          &&message.synchronizationEpoch===current.synchronizationEpoch)
          publish(current, { kind: 'onset', captureId: current.captureId, sequence: ++current.sequence, bands: [...new Set(message.bands)], ...diagnostic });
        else telemetry.mark('EVENT_DROPPED',trace,{reason:'disabled'});
      }
      if (message.kind === 'tempo.state' && current.mode === 'capture' && current.clock?.playing
        && typeof message.tempo?.locked === 'boolean' && Number.isFinite(message.tempo.confidence)
        && message.tempo.confidence >= 0 && message.tempo.confidence <= 1
        && (message.tempo.bpm === null || Number.isFinite(message.tempo.bpm) && message.tempo.bpm >= 60 && message.tempo.bpm <= 180)) {
        delivered = true;
        publish(current, { kind: 'tempo.state', captureId: current.captureId, tempo: message.tempo, ...diagnostic });
      }
      if (message.kind === 'tempo.tick' && current.mode === 'capture' && current.clock?.playing
        && Number.isInteger(message.tick?.step) && message.tick.step >= 0 && message.tick.step < 8
        && Number.isFinite(message.tick.phase) && message.tick.phase >= 0 && message.tick.phase < 1
        && Number.isFinite(message.tick.beatPosition) && message.tick.beatPosition >= 0
        && message.tick.subdivision === 2) {
        delivered = true;
        const { step, phase, beatPosition, subdivision } = message.tick;
        publish(current, { kind: 'tempo.tick', captureId: current.captureId, tick: { step, phase, beatPosition, subdivision }, ...diagnostic });
      }
      if (!delivered) telemetry.mark('EVENT_DROPPED', trace, { reason: current.mode !== 'capture' ? 'clock' : !current.clock?.playing ? 'not-playing' : 'invalid' });
      if (message.kind === 'stopped') {
        current.captureError = captureError(message.captureError);
        current.retryAt = Date.now() + (message.reason === 'failed' ? 3000 : 0);
        current.fallbackReason = ['expired', 'silent', 'ended', 'failed'].includes(message.reason) ? message.reason : 'stopped';
        cancelCapture(current);
        // Retain the clock subscription; the next active clock or renewal
        // reacquires capture without requiring another toolbar invocation.
        current.recoveryReason = current.fallbackReason;
        void capture(current);
      }
    },
    invoke(tabId) {
      // This click can grant browser permission. It is not our own permission
      // flag: automatic attempts always ask Chrome, including after reloads.
      const current=state;
      if(current?.session.tabId===tabId) {
        // A click may arrive while the initial uninvoked request is failing.
        // Retry after it settles so that request cannot consume the new grant.
        if(current.captureTask)void current.captureTask.finally(()=>{if(state===current)void capture(current,true);});
        else void capture(current,true);
      }
    },
    tabClosed(tabId) {
      if (state && (state.session.tabId === tabId || state.owner.tabId === tabId)) void stopIfCurrent(state);
    },
    tabLoading(tabId) {
      // Source navigation invalidates its audio immediately. App SPA URL updates
      // keep the same document; pagehide, receiver failure and leases release it.
      if(state?.session.tabId===tabId)void stopIfCurrent(state,'track-changed');
    },
    tabMuted(tabId, muted) {
      if (state?.session.tabId !== tabId) return;
      state.tabMuted = muted;
      if (muted) cancelCapture(state);
      else { state.retryAt = 0; void capture(state); }
    },
  };
}
