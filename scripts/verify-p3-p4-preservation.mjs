import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='scratch/p3-p4-261026-1706';
const admission=JSON.parse(await readFile(root+'/admission.json','utf8'));
const mutable=new Set(['src/features/music/BeatPattern.tsx','src/features/music/SemanticBeatPattern.tsx','src/features/music/semantic-motion-pattern.tsx',
  'src/features/music/useMusicBeatSync.ts','src/features/music/beat-row-diagnostics.ts','src/components/focus/floatingFocus.css',
  'extensions/kanban-music/beat-telemetry.integration.test.js']);
const hashes={},digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,before]of Object.entries(admission.hashes)){
  const after=digest(await readFile(file));hashes[file]={before,after,changed:before!==after,intentionallyTouched:mutable.has(file)};
  if(!mutable.has(file))assert.equal(after,before,`Protected baseline changed: ${file}`);
}
const modelFiles={'extensions/kanban-music/generated/percussion/percussion.onnx':'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',
  [root+'/companion/extension/generated/percussion/percussion.onnx']:'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',
  [root+'/companion/extension/generated/hybrid/model.onnx']:'785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'};
for(const [file,expected]of Object.entries(modelFiles))assert.equal(digest(await readFile(file)),expected,`Frozen model ${file}`);
const privateManifest=JSON.parse(await readFile(root+'/companion/extension/manifest.json','utf8'));
const desktop=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));
const report={at:new Date().toISOString(),hashes,models:modelFiles,privateCompanionVersion:privateManifest.version,desktopVersion:desktop.version,
  privateCsp:privateManifest.content_security_policy,privatePermissions:privateManifest.permissions,updaterUnchanged:hashes['src-tauri/tauri.conf.json']?.changed===false,
  artifactPublication:false,installedEnvironmentChanged:false,physicalVerified:false};
await writeFile(root+'/preservation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({protectedFiles:Object.values(hashes).filter(h=>!h.intentionallyTouched).length,models:Object.keys(modelFiles).length,status:'PASS'}));
