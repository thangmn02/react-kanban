import {expect,it} from 'vitest';
import {decideBeatMode,bufferRequirement,verifiedTrackMatches,parseBeatMode,validSyncConfiguration} from './beat-mode.js';
it('observes exact compensation prerequisites without changing any policy result',()=>{
  const f=facts(),normal=decideBeatMode(f,10000),observed=decideBeatMode({...f,diagnostics:true},10000);
  const {prerequisites,...result}=observed;expect(result).toEqual(normal);
  expect(prerequisites).toMatchObject({sourceEligible:true,captureEligible:true,ownerValid:true,outputRouteHealthy:true,clockHealthy:true});
  f.clock.buffering=true;expect(decideBeatMode({...f,diagnostics:true},10000).prerequisites.clockHealthy).toBe(false);
  f.clock.buffering=false;f.clock.sampledAt=8499;
  expect(decideBeatMode({...f,diagnostics:true},10000)).toMatchObject({compensationEligible:false,clockHealthy:false});
});
const facts=()=>({privateCandidate:true,surface:'web',
  source:{id:'owned-audio',version:'1',contentSha256:'a'.repeat(64),provider:'local',kind:'audio-only',singleSource:true,noVideo:true,noFrames:true},
  capture:{id:'capture',owner:'owner',expectedOwner:'owner',active:true,audible:true,output:'tab-replacement',originalSuppressed:true},
  clock:{sampledAt:10000,generation:1,playbackRate:1,playing:false,paused:true},
  detector:{id:'adtof',version:'1',trained:true,privateUseAllowed:true,accuracyQualified:false},
  timing:{samples:64,p95Ms:240,p99Ms:265},
  experiment:{enabled:true,intentionalDelay:true,outputHeard:true,authorizedAudio:true,captureId:'capture',generation:1,bufferMs:310,preview:true}});
it('allows only an explicitly consented, owned audio-only experimental path',()=>{
  expect(decideBeatMode(facts(),10000)).toMatchObject({mode:'experimental-buffered',bufferMs:310,allowSemantic:false,allowTypedPreview:true,physicalVerified:false});
  expect(parseBeatMode(decideBeatMode(facts(),10000))).toMatchObject({mode:'experimental-buffered'});
});
it.each(['video','unknown'])('does not infer audio-only eligibility from a provider hostname (%s)',kind=>{
  const f=facts();f.source.provider='youtube';f.source.kind=kind;
  expect(decideBeatMode(f,10000)).toMatchObject({bufferMs:0,allowTypedPreview:false,allowSemantic:false});
});
it('blocks Spotify analysis and buffering regardless of local/API/capture workarounds',()=>{
  const f=facts();f.source.provider='spotify';
  expect(decideBeatMode(f,10000)).toMatchObject({mode:'unsupported',support:'policy-blocked',allowAnalysis:false,allowCapture:false,bufferMs:0});
});
it.each(['surface','capture','clock','consent','frames','video','single-source','original-output','rate','generation','protected','private-flag','budget'])('fails closed for missing %s proof',field=>{
  const f=facts();
  if(field==='surface')f.surface='desktop';
  if(field==='capture')f.capture.owner='other';
  if(field==='clock')f.clock.sampledAt=1;
  if(field==='consent')f.experiment.outputHeard=false;
  if(field==='frames')f.source.noFrames=false;
  if(field==='video')f.source.noVideo=false;
  if(field==='single-source')f.source.singleSource=false;
  if(field==='original-output')f.capture.originalSuppressed=false;
  if(field==='rate')f.clock.playbackRate=1.25;
  if(field==='generation')f.experiment.generation=0;
  if(field==='protected')f.source.protectedMedia=true;
  if(field==='private-flag')f.privateCandidate=false;
  if(field==='budget')f.timing.p99Ms=900;
  expect(decideBeatMode(f,10000).bufferMs).toBe(0);
});
it('requires exact independently verified recording and version for cached semantic events',()=>{
  const f=facts();const track={status:'independently-verified',revision:'r1',annotationSha256:'b'.repeat(64),
    sourceId:f.source.id,sourceVersion:f.source.version,sourceSha256:f.source.contentSha256};
  expect(verifiedTrackMatches(f.source,track)).toBe(true);
  f.eventTrack=track;expect(decideBeatMode(f,10000).mode).toBe('verified-cache');
  f.source.version='2';expect(verifiedTrackMatches(f.source,track)).toBe(false);
  track.status='model-generated';expect(verifiedTrackMatches(f.source,track)).toBe(false);
});
it('does not mistake trained bidirectional ADTOF or a JavaScript peak picker for a qualified live model',()=>{
  const f=facts();f.experiment.enabled=false;f.detector.endToEndP95Ms=240;
  expect(decideBeatMode(f,10000).mode).toBe('degraded');
  Object.assign(f.detector,{accuracyQualified:true,browserBudgetQualified:true,endToEndP95Ms:30});
  expect(decideBeatMode(f,10000)).toMatchObject({mode:'live-qualified',physicalVerified:false});
});
it('bounds calibration and rejects forged controls',()=>{
  expect(bufferRequirement({samples:31,p95Ms:240,p99Ms:260})).toBeUndefined();
  expect(bufferRequirement({samples:32,p95Ms:240,p99Ms:260})).toBe(300);
  expect(bufferRequirement({samples:32,p95Ms:500,p99Ms:600})).toBeUndefined();
  expect(validSyncConfiguration(facts().experiment)).toBe(true);
  expect(validSyncConfiguration({...facts().experiment,captureId:'http://source-secret'})).toBe(false);
  expect(validSyncConfiguration({...facts().experiment,detectorVariant:'L1-gap0'})).toBe(false);
  expect(validSyncConfiguration({...facts().experiment,live:true,latencyAccepted:true,detectorVariant:'L1-gap0'})).toBe(true);
  expect(validSyncConfiguration({...facts().experiment,live:true,latencyAccepted:true,detectorVariant:'L1-immediate'})).toBe(false);
});
it('pins private comparison playback to 500 ms only after in-budget calibration',()=>{
  const f=facts();f.detector.comparisonBufferMs=500;f.experiment.bufferMs=500;
  expect(decideBeatMode(f,10000)).toMatchObject({mode:'experimental-buffered',requiredBufferMs:500,bufferMs:500});
  f.timing.p99Ms=900;
  expect(decideBeatMode(f,10000)).toMatchObject({bufferEligible:false,requiredBufferMs:0,bufferMs:0,allowTypedPreview:false});
});
it('admits an explicitly consented unbuffered video preview without calibration',()=>{
  const f=facts();f.source.kind='video';f.source.noVideo=false;f.source.noFrames=false;f.timing={};
  Object.assign(f.clock,{playing:true,paused:false});
  Object.assign(f.experiment,{live:true,latencyAccepted:true,bufferMs:0,intentionalDelay:false});
  const mode=decideBeatMode(f,10000);
  expect(mode).toMatchObject({mode:'experimental-live',allowTypedPreview:true,allowSemantic:false,
    bufferMs:0,bufferEligible:false,livePreviewEligible:true,physicalVerified:false});
  expect(parseBeatMode(mode)).toMatchObject({mode:'experimental-live',livePreviewEligible:true});
  expect(validSyncConfiguration(f.experiment)).toBe(true);
  f.experiment.latencyAccepted=false;
  expect(validSyncConfiguration(f.experiment)).toBe(false);
  expect(decideBeatMode(f,10000).allowTypedPreview).toBe(false);
});
it.each(['private','provider','protected','owner','source','clock','capture','rights','delay','generation'])('rejects live preview with invalid %s proof',field=>{
  const f=facts();Object.assign(f.clock,{playing:true,paused:false});Object.assign(f.experiment,{live:true,latencyAccepted:true,bufferMs:0});
  if(field==='private')f.privateCandidate=false;
  if(field==='provider')f.source.provider='spotify';
  if(field==='protected')f.source.protectedMedia=true;
  if(field==='owner')f.capture.owner='other';
  if(field==='source')f.source.kind='unknown';
  if(field==='clock')f.clock.sampledAt=0;
  if(field==='capture')f.capture.active=false;
  if(field==='rights')f.detector.privateUseAllowed=false;
  if(field==='delay')f.experiment.bufferMs=300;
  if(field==='generation')f.experiment.generation=2;
  expect(decideBeatMode(f,10000).allowTypedPreview).toBe(false);
});
it.each([{playing:false,paused:true},{playing:false,paused:false},{playing:true,paused:true}])('rejects live preview unless its clock is actively playing (%j)',clock=>{
  const f=facts();Object.assign(f.experiment,{live:true,latencyAccepted:true,bufferMs:0});Object.assign(f.clock,clock);
  expect(decideBeatMode(f,10000)).toMatchObject({livePreviewEligible:false,livePreviewReason:'not-playing',allowTypedPreview:false,bufferMs:0});
});
it('reports live Lead only for a private capture whose tracker is running, and parses it for Kora',()=>{
  const running=decideBeatMode({...facts(),health:{leadLive:true}},10000);
  expect(running.leadLive).toBe(true);expect(parseBeatMode(running).leadLive).toBe(true);
  expect(decideBeatMode(facts(),10000).leadLive).toBe(false);
  expect(decideBeatMode({...facts(),privateCandidate:false,health:{leadLive:true}},10000).leadLive).toBe(false);
  expect(parseBeatMode({...running,leadLive:'yes'}).leadLive).toBe(false);
});
