// Add calibration context without changing the frozen acoustic benchmark.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const folder=resolve('scratch/xo-percussion-recovery');
const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=[];
for(const id of ['hat-only','snare-only']){
  const fixture=manifest.fixtures.find(f=>f.id===id),original=await readFile(resolve(folder,fixture.wav));
  assert.equal(hash(original),fixture.wavSha256);
  const rate=44100,bytesPerSecond=rate*4,pcm=original.subarray(44);
  const output=Buffer.alloc(44+70*bytesPerSecond);original.copy(output,0,0,44);
  output.writeUInt32LE(output.length-8,4);output.writeUInt32LE(output.length-44,40);
  for(const at of [0,14,28,44])pcm.copy(output,44+at*bytesPerSecond);
  const wav=id+'-transport.wav';await writeFile(resolve(folder,wav),output);
  fixtures.push({id,wav,wavSha256:hash(output),originalWavSha256:fixture.wavSha256,
    analysisStart:44,analysisEnd:58,referenceStatus:'deterministic-synthetic-reference',
    context:'Three copies for calibration; two seconds of silence; unchanged fixture at 44 s; twelve trailing seconds preserve capture during collection.'});
}
await writeFile(resolve(folder,'transport-manifest.json'),JSON.stringify({fixtures},null,2)+'\n');
console.log(JSON.stringify(fixtures));
