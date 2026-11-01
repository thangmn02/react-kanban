import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareSourceAudioDelay} from './source-audio-delay-package.mjs';
import {prepareEnhancedBeatSync} from './enhanced-beat-sync-package.mjs';
import {prepareHybridHats,hybridHatsVersion} from './hybrid-hat-package.mjs';

async function build(){
 const source='extensions/kanban-music/',files=[];
 for(const name of await readdir(source))if((name.endsWith('.js')&&!name.endsWith('.test.js')||name==='manifest.json')&&!['hybrid-pcm-worklet.js','hybrid-cnn-worker.js'].includes(name))files.push({name,bytes:await readFile(source+name)});
 files.push({name:'generated/percussion/percussion.onnx',bytes:await readFile(source+'generated/percussion/percussion.onnx')});
 prepareSourceAudioDelay(files);prepareEnhancedBeatSync(files);
 return {files,proof:await prepareHybridHats(files,resolve('.'))};
}
const text=(files,name)=>files.find(file=>file.name===name).bytes.toString();

test('the public Companion routes Kick/Snare to ADTOF and Hi-Hat to the CNN by default',async()=>{
 const {files,proof}=await build(),engine=text(files,'capture-engine.js');
 assert.equal(JSON.parse(text(files,'manifest.json')).version,hybridHatsVersion);
 assert.match(proof.routing,/Hi-Hat CNN/);
 assert.ok(engine.includes("hybridMode:'H-LIVE',hybridFallback:false,"));
 assert.ok(engine.includes("state.hybridMode=state.hybridFallback?'L0':'H-LIVE';"),'Enhanced Beat Sync settings keep H.');
});
test('a failing CNN falls back to ADTOF Hi-Hats at once instead of darkening the drum rows',async()=>{
 const engine=text((await build()).files,'capture-engine.js');
 assert.ok(engine.includes("if(state.hybridMode==='H-LIVE'){state.hybridMode='L0';state.hybridFallback=true;state.percussionRetryAt=now();"));
});
test('the CNN, its resampler and every licence notice ship together and the worker imports resolve (vendored ONNX Runtime is checked by the packager)',async()=>{
 const {files}=await build(),names=new Set(files.map(file=>file.name));
 for(const name of ['generated/hybrid/model.onnx','generated/hybrid/coefficients.json','generated/hybrid/soxr_wasm.wasm','generated/hybrid/soxr-glue.mjs',
  'hybrid-frontend.mjs','hybrid-soxr.mjs','hybrid-source-guard.mjs','hybrid-pcm-worklet.js',
  'third-party/cnn-hihat/CNN-LICENSE.txt','third-party/cnn-hihat/WRAPPER-LICENSE.txt','third-party/cnn-hihat/NOTICE.md'])assert.ok(names.has(name),name);
 assert.match(text(files,'third-party/cnn-hihat/CNN-LICENSE.txt'),/AFFERO GENERAL PUBLIC LICENSE/);
 for(const file of files.filter(file=>/\.(m?js)$/.test(file.name)))
  for(const match of file.bytes.toString().matchAll(/from\s+["']\.\/([^"']+)["']/g))if(!match[1].startsWith('vendor/'))assert.ok(names.has(match[1]),`${file.name} → ${match[1]}`);
});
