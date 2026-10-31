import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareNativeCompanionDelay} from './native-companion-delay-package.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs={
  'capture-engine.js':'14667a47e1336b0ff36c1db9b1e6304f1bacafa4830f77505db9bb20d15b99df',
  'offscreen.js':'69c88dea1cd4becacb154ff0bba9d665ca7275aa25b74df5595f41754b8d0616',
  'beat-candidate.js':'98909f840afe54abf9602c102cc773f74aba3562449cb2a16bf7abaee2e7a260',
};
const contract=`export function sourceDelayConfiguration(value) {
  return Boolean(value && typeof value.enabled==='boolean' && value.preview===value.enabled
    && value.live!==true && (value.detectorVariant===undefined||value.detectorVariant==='L0')
    && Number.isInteger(value.compensationMs) && value.compensationMs>=0 && value.compensationMs<=300
    && (value.enabled ? value.compensationMs>0 && value.intentionalDelay===true
      && value.outputHeard===true && value.authorizedAudio===true : value.compensationMs===0));
}
`;

/** Build a separate candidate; frozen source and existing packages are untouched. */
export function prepareSourceAudioDelay(files){
  const copies=files.map(file=>({...file,bytes:Buffer.from(file.bytes)}));
  const get=name=>{const matches=copies.filter(file=>file.name===name);assert.equal(matches.length,1);return matches[0];};
  for(const[name,expected]of Object.entries(inputs))assert.equal(hash(get(name).bytes.toString().replaceAll('\r\n','\n')),expected,'Source delay input changed: '+name);
  const transport=prepareNativeCompanionDelay(copies);
  function edit(name,fn){const file=get(name);let source=file.bytes.toString().replaceAll('\r\n','\n');
    const replace=(before,after,count=1)=>{assert.equal(source.split(before).length-1,count,'Source delay boundary changed: '+name);source=source.split(before).join(after);};
    fn(replace,()=>source,value=>{source=value;});file.bytes=Buffer.from(source);
  }
  edit('beat-candidate.js',replace=>replace('export const privateBeatCandidate = false;','export const privateBeatCandidate = false;\nexport const sourceAudioDelayCandidate = true;'));
  edit('beat-sync.js',(replace,read,set)=>{
    replace('import { privateBeatCandidate, candidateDetector }','import { privateBeatCandidate, sourceAudioDelayCandidate, candidateDetector }');
    replace("import { privateBeatCandidate, sourceAudioDelayCandidate, candidateDetector } from './beat-candidate.js';","import { privateBeatCandidate, sourceAudioDelayCandidate, candidateDetector } from './beat-candidate.js';\nimport {sourceDelayConfiguration} from './source-audio-delay-contract.js';");
    // Keep diagnostics private. All other advanced gates follow the exact native owner.
    let gates=0;
    set(read().split('\n').map(line=>{
      if(!line.includes('privateBeatCandidate')||line.startsWith('import ')||line.includes('validDiagnosticRequest'))return line;
      gates+=line.split('privateBeatCandidate').length-1;
      return line.replaceAll('privateBeatCandidate',line.includes('capability(state)')||line.includes("state.mode === 'capture'")?'delayCandidate(state)':'delayCandidate(current)');
    }).join('\n'));
    assert.equal(gates,19,'Every optional gate must be accounted for.');
    replace('  const modeFacts = current =>','  const delayCandidate = current => privateBeatCandidate || sourceAudioDelayCandidate && Boolean(current?.owner?.native) && current.owner.nativeAudio===false;\n  const modeFacts = current =>');
    replace('||!validSyncConfiguration(configuration)||configuration.captureId!==current.captureId','||!validSyncConfiguration(configuration)||sourceAudioDelayCandidate&&!sourceDelayConfiguration(configuration)||configuration.captureId!==current.captureId');
    replace('protectedMedia:current.clock?.protectedMedia===true||current.session.protectedMedia===true},','protectedMedia:current.clock?.protectedMedia===true||current.session.protectedMedia===true,hidden:current.tabHidden===true},');
    replace('      current.clock = clock;',`      current.clock = clock;
      if(delayCandidate(current)&&Date.now()-(current.tabCheckedAt||0)>=500){current.tabCheckedAt=Date.now();
        void Promise.resolve(api.tabs.get?.(current.session.tabId)).then(tab=>tab&&Promise.resolve(api.windows?.get?.(tab.windowId))
          .then(win=>{current.tabHidden=!tab.active||win?.state==='minimized';})).catch(()=>{current.tabHidden=false;});}`);
  });
  edit('capture-engine.js',replace=>{
    replace('import { privateBeatCandidate, privatePercussionDiagnostics,','import { privateBeatCandidate, sourceAudioDelayCandidate, privatePercussionDiagnostics,');
    replace('if(privateBeatCandidate)await teardown;','if(privateBeatCandidate||sourceAudioDelayCandidate&&requestOptions.candidate===true)await teardown;');
    replace('candidate:privateBeatCandidate&&requestOptions.candidate===true','candidate:(privateBeatCandidate||sourceAudioDelayCandidate)&&requestOptions.candidate===true');
    // Fade the audible branch before releasing capture, so Chrome's restored tab output follows silence, not a click.
    replace("import { createDelayedAudioOutput } from './delayed-audio-output.js';","import { createSmoothAudioOutput as createDelayedAudioOutput } from './source-delay-audio-output.js';");
    replace('    previous.output?.stop();','    const outputReleased=previous.output?.stop();');
    replace('previous.events?.splice(0);teardown=Promise.resolve(release());','previous.events?.splice(0);teardown=outputReleased?outputReleased.then(release,release):Promise.resolve(release());');
  });
  // Delay must never put a visible video's sound behind its picture. Audio-only media qualifies, or a video whose tab
  // is not the active tab of a non-minimized window. Chrome tells a captured page it is visible, so the browser's
  // tab state is the signal (see beat-sync.js above); each clock sample refreshes it, so revealing the video revokes the delay.
  edit('beat-mode.js',replace=>replace('const compensationEligible=Boolean(liveSource&&',"const compensationEligible=Boolean(liveSource&&(source.kind==='audio-only'&&source.noVideo===true||source.hidden===true)&&"));
  edit('offscreen.js',replace=>{
    replace('import { privateBeatCandidate, privatePercussionDiagnostics }','import { privateBeatCandidate, sourceAudioDelayCandidate, privatePercussionDiagnostics }');
    replace('...(privateBeatCandidate?{health:engine.health}:{})','...((privateBeatCandidate||sourceAudioDelayCandidate)?{health:engine.health}:{})');
  });
  edit('widget-bridge.js',replace=>{
    replace("import { validSyncConfiguration } from './beat-mode.js';","import { validSyncConfiguration } from './beat-mode.js';\nimport {sourceDelayConfiguration} from './source-audio-delay-contract.js';");
    replace("request.action === 'beat.experimental.configure' && validSyncConfiguration(request.configuration)","request.action === 'beat.experimental.configure' && validSyncConfiguration(request.configuration) && sourceDelayConfiguration(request.configuration)");
  });
  copies.push({name:'source-audio-delay-contract.js',bytes:Buffer.from(contract)});
  const manifest=get('manifest.json'),metadata=JSON.parse(manifest.bytes);metadata.version='0.3.29';metadata.name='Kora Music Companion Release Candidate';metadata.version_name='0.3.29 optional source audio delay · evaluation';manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  const proof={optionalSourceAudioDelay:true,privateOnly:false,modelChanged:false,defaultWindowsCaptureChanged:false,ordinaryWebCaptureChanged:false,physicalVerified:false,
    transportBaseTransform:transport.files,files:copies.filter(file=>['source-audio-delay-contract.js','source-delay-audio-output.js'].includes(file.name)||files.find(original=>original.name===file.name&&!original.bytes.equals(file.bytes))).map(file=>({name:file.name,outputSha256:hash(file.bytes)}))};
  files.splice(0,files.length,...copies);return proof;
}

const classifierInput='percussion-classifier.js';
/** Owner A/B: Hi-Hat compares each rise with its local valley, as Kick and Snare keep the rolling mean.
 * Dense hats keep the 120 ms rolling mean high and hide real hits; Snare is excluded because the
 * Oct 16 XO comparison showed local prominence adds false Hats on Snare-only audio. */
export function prepareHatProminence(files){
  const file=files.find(entry=>entry.name===classifierInput);assert.ok(file,'Classifier missing');
  let source=file.bytes.toString().replaceAll('\r\n','\n');
  const before='    if(this.localProminence&&[1,3,4].includes(classIndex)) {';
  assert.equal(source.split(before).length-1,1,'Hat prominence boundary changed');
  source=source.replace(before,'    if((this.localProminence?[1,3,4]:[3,4]).includes(classIndex)) {');
  file.bytes=Buffer.from(source);
  const manifest=files.find(entry=>entry.name==='manifest.json'),metadata=JSON.parse(manifest.bytes);
  metadata.version_name='0.3.29 optional source audio delay · hat prominence A/B · evaluation';manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  return {classes:['hat'],excluded:['kick','snare'],modelChanged:false,thresholdsChanged:false,file:classifierInput};
}
