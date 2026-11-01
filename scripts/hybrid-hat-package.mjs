import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const hybridHatsVersion='0.3.34';
const cnnSha256='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db';
const adtofSha256='c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a';

/** Public Hybrid hats, the lab's H routing: ADTOF Kick/Snare + the frame CNN Hi-Hat. Layered on Enhanced Beat Sync.
 *  The CNN and its resampler come from third-party/cnn-hihat (AGPL-3.0 model source, MIT wrapper over LGPL SoXR).
 *  If the CNN cannot start or stalls, that capture falls back to ADTOF Hi-Hats instead of losing the drum rows. */
export async function prepareHybridHats(files,root){
  const get=name=>{const matches=files.filter(file=>file.name===name);assert.equal(matches.length,1,name);return matches[0];};
  const vendor=join(root,'third-party','cnn-hihat'),extension=join(root,'extensions','kanban-music');
  const model=await readFile(join(vendor,'model.onnx'));
  assert.equal(hash(model),cnnSha256,'CNN hat model changed');
  assert.equal(hash(get('generated/percussion/percussion.onnx').bytes),adtofSha256,'ADTOF model changed');
  const sources={
    'hybrid-pcm-worklet.js':join(extension,'hybrid-pcm-worklet.js'),
    'hybrid-cnn-worker.js':join(extension,'hybrid-cnn-worker.js'),
    'hybrid-frontend.mjs':join(root,'scripts/cnn-browser-frontend.mjs'),
    'hybrid-soxr.mjs':join(root,'scripts/research-cnn-live/soxr-wasm-adapter.mjs'),
    'hybrid-source-guard.mjs':join(root,'scripts/research-cnn-live/source-segment-guard.mjs'),
    'generated/hybrid/coefficients.json':join(vendor,'coefficients.json'),
    'generated/hybrid/soxr_wasm.wasm':join(vendor,'soxr_wasm.wasm'),
    'third-party/cnn-hihat/CNN-LICENSE.txt':join(vendor,'CNN-LICENSE.txt'),
    'third-party/cnn-hihat/CNN-README.source.txt':join(vendor,'CNN-README.source.txt'),
    'third-party/cnn-hihat/WRAPPER-LICENSE.txt':join(vendor,'WRAPPER-LICENSE.txt'),
    'third-party/cnn-hihat/NOTICE.md':join(vendor,'NOTICE.md'),
  };
  for(const [name,path] of Object.entries(sources)){
    let bytes=await readFile(path);
    if(name==='hybrid-cnn-worker.js'){
      let source=bytes.toString();
      for(const [before,after] of [['../../scripts/cnn-browser-frontend.mjs','./hybrid-frontend.mjs'],
        ['../../scripts/research-cnn-live/soxr-wasm-adapter.mjs','./hybrid-soxr.mjs'],
        ['../../scripts/research-cnn-live/source-segment-guard.mjs','./hybrid-source-guard.mjs']]){
        assert.equal(source.split(before).length,2,'Hybrid worker import changed: '+before);source=source.replace(before,after);
      }
      bytes=Buffer.from(source);
    }
    assert.ok(!files.some(file=>file.name===name),'Already packaged: '+name);
    files.push({name,bytes});
  }
  files.push({name:'generated/hybrid/model.onnx',bytes:model});
  const glue=(await readFile(join(vendor,'soxr_wasm.js'),'utf8')).replace(/\/\/# sourceMappingURL=.*$/m,'');
  files.push({name:'generated/hybrid/soxr-glue.mjs',bytes:Buffer.from('const exports = {};\n'+glue+'\nexport default exports.default;')});

  const engine=get('capture-engine.js');let source=engine.bytes.toString().replaceAll('\r\n','\n');
  const replace=(before,after)=>{assert.equal(source.split(before).length-1,1,'Hybrid hats boundary changed: '+before.slice(0,60));source=source.split(before).join(after);};
  // H is the default; a settings change keeps it unless that capture already fell back.
  replace("hybridMode:'L0',","hybridMode:'H-LIVE',hybridFallback:false,");
  replace("state.hybridMode=settings.eligible===true&&['H-SHADOW','H-LIVE'].includes(settings.detectorVariant)?settings.detectorVariant:'L0';",
    "state.hybridMode=state.hybridFallback?'L0':'H-LIVE';");
  // A CNN that fails or stalls must not cost the drum rows: retry once with ADTOF Hi-Hats for the rest of this capture.
  replace("          state.percussionRecovery = reason;\n",
    "          state.percussionRecovery = reason;\n          if(state.hybridMode==='H-LIVE'){state.hybridMode='L0';state.hybridFallback=true;state.percussionRetryAt=now();telemetry.record('EVENT_DROPPED',undefined,{captureId,reason:'hybrid-fallback'});return;}\n");
  engine.bytes=Buffer.from(source);
  const manifest=get('manifest.json'),metadata=JSON.parse(manifest.bytes);
  metadata.version=hybridHatsVersion;manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  return {hybridHats:true,routing:'Kick/Snare ADTOF, Hi-Hat CNN, ADTOF Hi-Hat fallback',cnnSha256,adtofSha256};
}
