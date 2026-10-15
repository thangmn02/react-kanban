import {expect,it} from 'vitest';
import {decideBeatMode,bufferRequirement,verifiedTrackMatches,parseBeatMode,validSyncConfiguration} from './beat-mode.js';
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
});
