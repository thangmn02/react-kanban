// Re-evaluate the exact captured feature tensors; no PCM or model replacement.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve('scratch/hat-playback-discrepancy'),output=resolve(folder,'captured-replay');
await mkdir(output,{recursive:true});const fixtures=[];
const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));
for(const file of ['actual-msedge-xo-hat-only-snare-only.json','actual-msedge-xo-load.json']){
 const result=JSON.parse(await readFile(resolve(folder,file),'utf8'));assert.deepEqual(result.errors,[]);
 for(const run of result.results){
  assert(run.finishedAt&&run.featureBlocks?.length);
  const id=run.variant+'-'+run.input+(run.load?'-load':''),sourcePath=resolve(output,id+'-features.json');
  const bytes=Buffer.from(JSON.stringify({featureBlocks:run.featureBlocks}));await writeFile(sourcePath,bytes);
  fixtures.push({id,inputEncoding:'features',sourcePath,sourceSha256:createHash('sha256').update(bytes).digest('hex'),
   analysisStart:run.featureBlocks[0].times[0]+1.2,analysisEnd:run.featureBlocks.at(-1).times.at(-1),
   kind:'captured-model-input',referenceStatus:'pipeline-replay-only',scoringEligible:false,originalArtifact:file});
 }
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify({modelSha256:manifest.modelSha256,fixtures},null,2)+'\n');
console.log(JSON.stringify({fixtures:fixtures.length,output}));
