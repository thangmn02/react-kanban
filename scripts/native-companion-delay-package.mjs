import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const inputs={
  'beat-sync.js':'683ad6c35f2cb3d518c378564ffd7530ac43cd8881d0d3b2528934cc29a886e5',
  'beat-mode.js':'acef25de51e6193ea2fed41eedfb59650bf9b08ee5c4ea781f997fa6ae05bff7',
  'widget-bridge.js':'774b2b879f05e1acdacbef10fd4a623cf2cb949e0546894cd06bbd47364ac2d2',
};
const digest=value=>createHash('sha256').update(value).digest('hex');
export function assertNativeDelayGuide(text){
  for(const required of ['Companion 0.3.28','dedicated automation browser/profile','Kora 0.1.32 Owner Preview','Windows PCM must be off','Pause the source','Turn compensation OFF'])assert.ok(text.includes(required),'Incomplete isolated native-delay guide.');
  assert.doesNotMatch(text,/Reload this unpacked extension|Use (?:your )?Brave|Private live L0 \/ L1|prepare-beat-corpus/);
}
/** Transform only a separate private package; never write extension source. */
export function prepareNativeCompanionDelay(files){
  const pending=[],proof=[];
  for(const [name,expected]of Object.entries(inputs)){
    const matches=files.filter(file=>file.name===name);assert.equal(matches.length,1);
    const file=matches[0];let source=file.bytes.toString().replaceAll('\r\n','\n');
    assert.equal(digest(source),expected,`Private delay input changed: ${name}`);
    const replace=(before,after,count=1)=>{assert.equal(source.split(before).length-1,count,`Private delay boundary changed: ${name}`);source=source.split(before).join(after);};
    if(name==='beat-sync.js'){
      replace("output:current.owner.native?'native-monitor':'tab-replacement'","output:current.owner.nativeAudio?'native-monitor':'tab-replacement'");
      replace('current.originalSuppressed===true&&!current.owner.native','current.originalSuppressed===true&&!current.owner.nativeAudio');
      replace('&&!current.owner.native&&','&&!current.owner.nativeAudio&&');
      replace('if(privateBeatCandidate&&!current.owner.native) {','if(privateBeatCandidate&&!current.owner.nativeAudio) {');
      replace('!sameOwner(current.owner,owner)||owner.native\n','!sameOwner(current.owner,owner)||current.owner.nativeAudio\n');
    }
    if(name==='beat-mode.js')replace("facts.surface==='web'","['web','desktop'].includes(facts.surface)",2);
    if(name==='widget-bridge.js'){
      replace("import { beatTelemetry } from './beat-telemetry.js';","import { beatTelemetry } from './beat-telemetry.js';\nimport { validSyncConfiguration } from './beat-mode.js';");
      replace("validCompanionUpdate(request) || request.action === 'sessions.get'","validCompanionUpdate(request) || request.action === 'sessions.get'\n      || request.action === 'beat.experimental.configure' && validSyncConfiguration(request.configuration)\n        && typeof request.sessionId === 'string' && request.sessionId.length > 0 && request.sessionId.length < 250");
    }
    pending.push({file,bytes:Buffer.from(source)});proof.push({name,inputNormalizedSha256:expected,outputSha256:digest(source)});
  }
  for(const {file,bytes}of pending)file.bytes=bytes;
  return {privateOnly:true,nativeTransport:true,audioOwner:'tab-replacement',windowsPcm:false,modelChanged:false,physicalVerified:false,files:proof};
}
