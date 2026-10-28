import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='scratch/p3-p4-261026-1706';
const admission=JSON.parse(await readFile(root+'/admission.json','utf8'));
const desktopConfig=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));
const baselineDesktopConfig=JSON.parse(execFileSync('git',['show',`${admission.head}:src-tauri/tauri.conf.json`],{encoding:'utf8'}));
const versionNumber=version=>{assert.match(version,/^\d+\.\d+\.\d+$/);return version.split('.').map(Number);};
const currentVersion=versionNumber(desktopConfig.version),baselineVersion=versionNumber(baselineDesktopConfig.version);
const firstDifferent=currentVersion.findIndex((value,index)=>value!==baselineVersion[index]);
assert.ok(firstDifferent<0||currentVersion[firstDifferent]>baselineVersion[firstDifferent],'Desktop release version must not decrease.');
const mutable=new Set(['src/features/music/BeatPattern.tsx','src/features/music/SemanticBeatPattern.tsx','src/features/music/semantic-motion-pattern.tsx',
  'src/features/music/useMusicBeatSync.ts','src/features/music/beat-row-diagnostics.ts','src/components/focus/floatingFocus.css',
  'extensions/kanban-music/beat-telemetry.integration.test.js']);
const hashes={},digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,before]of Object.entries(admission.hashes)){
  const bytes=await readFile(file),after=digest(bytes);
  const nativeNotesCapability=file==='src-tauri/tauri.conf.json'&&after!==before;
  const nativeNotesBuild=['src-tauri/build.rs','src-tauri/Cargo.toml'].includes(file)&&after!==before;
  if(nativeNotesBuild){
    const baseline=execFileSync('git',['show',`${admission.head}:${file}`]);
    assert.equal(digest(baseline),before,`Native admission differs from its recorded source: ${file}`);
    const normalize=value=>value.replace(/\r\n/g,'\n');
    if(file.endsWith('Cargo.toml')){
      assert.ok(bytes.toString().includes(`version = "${desktopConfig.version}"`),'Cargo and desktop release versions must match.');
      const restored=bytes.toString().replace(`version = "${desktopConfig.version}"`,`version = "${baselineDesktopConfig.version}"`).replace('features = ["tray-icon"]','features = []').replace(/^tauri-plugin-global-shortcut = "2"\r?\n/m,'').replace(/^tauri-runtime = "2"\r?\n/m,'').replace(', "Win32_Security_Cryptography", "Win32_Storage_FileSystem"','');
      assert.equal(normalize(restored),normalize(baseline.toString()),'Only tray/shortcut/window runtime and protected journal dependencies may extend native build dependencies.');
    }else{
      const commands=['native_music_request','native_music_setup','native_audio_start','native_audio_renew','native_audio_stop','native_dock_shape','native_notes_control','native_note_request'];
      const expected=`fn main() { tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[${commands.map(command=>JSON.stringify(command)).join(',')}]))).expect("Unable to generate scoped native command permissions") }`;
      assert.equal(bytes.toString().replace(/\s/g,''),expected.replace(/\s/g,''),'Native build helper may only register the scoped command manifest.');
    }
  }
  if(nativeNotesCapability)assert.equal(digest(Buffer.from(bytes.toString().replace(`"version": "${desktopConfig.version}"`,`"version": "${baselineDesktopConfig.version}"`).replace('"capabilities": ["widget", "notes"]','"capabilities": ["widget"]'))),before,'Only the requested native Notes capability and matching release version may extend the protected desktop configuration.');
  hashes[file]={before,after,changed:before!==after,intentionallyTouched:mutable.has(file)||nativeNotesCapability||nativeNotesBuild,nativeNotesCapability,nativeNotesBuild};
  if(!mutable.has(file)&&!nativeNotesCapability&&!nativeNotesBuild)assert.equal(after,before,`Protected baseline changed: ${file}`);
}
const modelFiles={'extensions/kanban-music/generated/percussion/percussion.onnx':'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',
  [root+'/companion/extension/generated/percussion/percussion.onnx']:'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',
  [root+'/companion/extension/generated/hybrid/model.onnx']:'785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'};
for(const [file,expected]of Object.entries(modelFiles))assert.equal(digest(await readFile(file)),expected,`Frozen model ${file}`);
const privateManifest=JSON.parse(await readFile(root+'/companion/extension/manifest.json','utf8'));
const desktop=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));
const report={at:new Date().toISOString(),hashes,models:modelFiles,privateCompanionVersion:privateManifest.version,desktopVersion:desktop.version,
  privateCsp:privateManifest.content_security_policy,privatePermissions:privateManifest.permissions,updaterUnchanged:!hashes['src-tauri/tauri.conf.json']?.changed||hashes['src-tauri/tauri.conf.json']?.nativeNotesCapability===true,
  artifactPublication:false,installedEnvironmentChanged:false,physicalVerified:false};
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length)||root+'/preservation.json';
assert.match(output,/^scratch\/[a-z0-9/_-]+\.json$/,'Preservation receipt must stay in scratch.');
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({protectedFiles:Object.values(hashes).filter(h=>!h.intentionallyTouched).length,models:Object.keys(modelFiles).length,status:'PASS'}));
