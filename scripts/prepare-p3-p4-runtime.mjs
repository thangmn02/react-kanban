// Local-only qualification build. Does not invoke prebuild or alter release resources.
import {build} from 'vite';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const name=process.argv.find(a=>a.startsWith('--name='))?.slice(7)||'runtime-app';
if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid build name');
const root=resolve('scratch/p3-p4-261026-1706'),output=resolve(root,name);
await mkdir(output,{recursive:false});process.env.VITE_AUTH_MODE='mock';
await build({publicDir:false,define:{'import.meta.env.DEV':'true'},build:{outDir:output,emptyOutDir:false,manifest:true}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets={};
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())await walk(file);else assets['/'+relative(output,file).replaceAll('\\','/')]=hash(await readFile(file));}}
await walk(output);
await writeFile(resolve(root,name==='runtime-app'?'runtime-build.json':name+'-receipt.json'),JSON.stringify({output,at:new Date().toISOString(),assets,privateDiagnostics:true,authMode:'mock',published:false},null,2));
const controlPath=resolve('scratch/browser-first-corpus/spaced-dev.wav'),control=await readFile(controlPath);
if(control.toString('ascii',36,40)!=='data'||control.readUInt32LE(40)!==control.length-44)throw Error('Endurance requires the existing standard 44-byte WAV control');
const header=Buffer.from(control.subarray(0,44)),data=control.subarray(44),duration=1900,bytes=header.readUInt32LE(28)*duration;
header.writeUInt32LE(bytes+36,4);header.writeUInt32LE(bytes,40);
const digest=createHash('sha256');digest.update(header);for(let i=0;i<bytes;i+=data.length)digest.update(data.subarray(0,Math.min(data.length,bytes-i)));
const sourceSha256=digest.digest('hex'),audioUrl='/scratch/p3-p4-261026-1706/endurance-control.wav';
await mkdir(resolve(root,'live/sources',sourceSha256),{recursive:true});
await writeFile(resolve(root,'live/sources',sourceSha256,'source.json'),JSON.stringify({audioUrl,sourceSha256,constructed:true,originalControl:controlPath,originalSha256:hash(control),durationSeconds:duration},null,2));
await writeFile(resolve(root,'endurance-source.json'),JSON.stringify({sourceSha256,audioUrl,controlPath,originalSha256:hash(control),durationSeconds:duration,totalBytes:bytes+44},null,2));
console.log(JSON.stringify({output,assets:Object.keys(assets).length}));
