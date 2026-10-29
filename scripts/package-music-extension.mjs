import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join,resolve,relative,isAbsolute } from 'node:path';
import { deflateSync } from 'node:zlib';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const extension = join(root, 'extensions', 'kanban-music');
const privateCandidate = process.argv.includes('--private');
const hybridCandidate=process.argv.includes('--hybrid-live');
if(hybridCandidate&&!privateCandidate)throw Error('Hybrid Live requires --private');
const diagnosticCandidate=process.argv.includes('--diagnostic-capture');
if(diagnosticCandidate&&!privateCandidate)throw Error('Continuous capture requires --private');
const labelMode=process.argv.find(argument=>argument.startsWith('--hat-label='))?.slice(12);
if(labelMode&&(!privateCandidate||!['M0','M1','shadow'].includes(labelMode)))throw Error('Hat label comparison requires --private and M0/M1/shadow');
const precisionMode=process.argv.find(argument=>argument.startsWith('--precision='))?.slice(12);
if(precisionMode&&(!privateCandidate||!['off','shadow'].includes(precisionMode)))throw Error('Precision requires --private and off/shadow; enabled has no qualified rules');
const xoCandidate=process.argv.find(argument=>argument.startsWith('--xo='))?.slice(5);
if(xoCandidate&&(!privateCandidate||!['A','B'].includes(xoCandidate)))throw Error('--xo=A or --xo=B requires --private');
const hatCandidate=process.argv.find(argument=>argument.startsWith('--hat='))?.slice(6);
if(labelMode&&(precisionMode||xoCandidate||hatCandidate))throw Error('Hat label comparison preserves existing DSP/classifier configuration; do not combine research package flags');
if(diagnosticCandidate&&(labelMode||precisionMode||xoCandidate||hatCandidate))throw Error('Continuous capture preserves the existing detector; do not combine candidate flags');
if(hatCandidate&&(!privateCandidate||xoCandidate||!['A','R'].includes(hatCandidate)))throw Error('--hat=A or --hat=R requires --private and cannot combine with --xo');
if(hybridCandidate&&(labelMode||precisionMode||xoCandidate||hatCandidate))throw Error('Hybrid Live preserves the original ADTOF classifier and guard settings');
const requestedOutput=process.argv.find(arg=>arg.startsWith('--output-root='))?.slice(14);
const outputRelative=requestedOutput?relative(resolve(root,'scratch'),resolve(root,requestedOutput)):undefined;
if(requestedOutput&&(!privateCandidate||!outputRelative||outputRelative==='..'||outputRelative.startsWith('..\\')||outputRelative.startsWith('../')||isAbsolute(outputRelative)))throw Error('Custom packages must be private research outputs inside scratch');
const output = requestedOutput?resolve(root,requestedOutput):hybridCandidate?join(root,'scratch','companion-hybrid-live','candidate'):diagnosticCandidate?join(root,'scratch','cross-track-hat-capture','candidate'):labelMode?join(root,'scratch','hat-label-contract','candidate-'+labelMode):precisionMode?join(root,'scratch','semantic-precision','candidate-'+precisionMode):hatCandidate?join(root,'scratch','hat-playback-discrepancy','candidate-'+hatCandidate):xoCandidate?join(root,'scratch','xo-percussion-recovery','candidate-'+xoCandidate)
  :privateCandidate ? join(root,'scratch','browser-first-candidate') : join(root, 'public', 'downloads');

// Rebuild release resources; the explicit inventory excludes private/retired
// models without deleting an existing developer's optional inference assets.
for (const path of privateCandidate ? [] : ['public/music-analysis', 'src-tauri/generated/music-companion']) {
  const target = join(root, path);
  if (!target.startsWith(root)) throw new Error('Generated resource outside project');
  await rm(target, { recursive: true, force: true });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function icon(size) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  const colors = [[194,109,67], [95,158,155], [189,152,71], [138,118,194]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const nx = x / size, ny = y / size;
    const cornerX = Math.max(.18 - nx, nx - .82, 0);
    const cornerY = Math.max(.18 - ny, ny - .82, 0);
    let rgb = [26, 26, 30];
    const visible = cornerX * cornerX + cornerY * cornerY <= .18 * .18;
    for (let bar = 0; bar < 4; bar++) {
      const height = [.27, .48, .65, .37][bar];
      if (nx >= .2 + bar * .16 && nx <= .3 + bar * .16 && Math.abs(ny - .5) <= height / 2) rgb = colors[bar];
    }
    rows.set([...rgb, visible ? 255 : 0], i);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Store-only ZIP entries keep the package reproducible and dependency-free.
function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const filename = Buffer.from(name);
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x21, 14); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(directory, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

await mkdir(join(extension, 'icons'), { recursive: true });
for (const size of [16, 48, 128]) await writeFile(join(extension, 'icons', `${size}.png`), icon(size));
const names = ['manifest.json', 'background.js', 'widget-bridge.js', 'sites.js', 'companion-action.js', 'media.js', 'media-observer.js', 'discovery-diagnostics.js', 'protocol.js', 'relay.js', 'clock.js', 'beat-sync.js', 'beat-detector.js', 'tempo-tracker.js', 'capture-engine.js', 'beat-telemetry.js', 'beat-timing.js', 'media-asset.js', 'offscreen.html', 'offscreen.js', 'setup.html', 'setup.js', 'setup.css', 'icons/16.png', 'icons/48.png', 'icons/128.png'];
names.push('companion-update.js', 'spotify-player.js');
names.push('beat-mode.js','beat-candidate.js');
names.push('delayed-audio-output.js');
names.push('semantic-precision-guards.js');
names.push('percussion-label-contract.js','inference-resources.js','model-assets.js');
if(privateCandidate)names.push('live-diagnostic-recorder.js');
names.push('hybrid-percussion-runtime.js','hybrid-live-contract.js');
const files = await Promise.all(names.map(async (name) => ({ name, bytes: await readFile(join(extension, name)) })));
function replaceExactlyOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Expected one package sentinel: ${before}`);
  return source.replace(before, after);
}
if(!privateCandidate){
  const offscreen=files.find(file=>file.name==='offscreen.js');
  let source=replaceExactlyOnce(offscreen.bytes.toString().replaceAll('\r\n','\n'),"import {LiveDiagnosticRecorder} from './live-diagnostic-recorder.js';\n",'');
  source=replaceExactlyOnce(source,'  createDiagnosticRecorder: options => new LiveDiagnosticRecorder(options),\n','');
  offscreen.bytes=Buffer.from(source);
}
if(privateCandidate) {
  const candidate=files.find(file=>file.name==='beat-candidate.js');
  let candidateSource=replaceExactlyOnce(candidate.bytes.toString(),'privateBeatCandidate = false','privateBeatCandidate = true');
  if(labelMode)candidateSource=replaceExactlyOnce(candidateSource,"privateHatLabelMapping = 'off'",`privateHatLabelMapping = '${labelMode}'`);
  if(hybridCandidate){
    candidateSource=replaceExactlyOnce(candidateSource,'hybridLiveAvailable:false','hybridLiveAvailable:true');
    candidateSource=replaceExactlyOnce(candidateSource,'privatePercussionDiagnostics = false','privatePercussionDiagnostics = true');
  }
  if(precisionMode)candidateSource=replaceExactlyOnce(candidateSource,"semanticPrecisionGuards = Object.freeze({mode:'off'})",`semanticPrecisionGuards = Object.freeze({mode:'${precisionMode}'})`);
  if(!xoCandidate&&!hatCandidate)candidateSource=replaceExactlyOnce(candidateSource,'earlyDecisionAvailable:false','earlyDecisionAvailable:true');
  if(xoCandidate||hatCandidate)for(const [before,after] of [
    ['privatePercussionDiagnostics = false','privatePercussionDiagnostics = true'],
    ["privatePercussionClassifier = 'onset-guided'",`privatePercussionClassifier = '${xoCandidate==='B'?'local-prominence':'onset-guided'}'`],
    ['comparisonBufferMs:0','comparisonBufferMs:500'],
    ["version:'1'",`version:'${hatCandidate?'hat-'+hatCandidate:'xo-'+xoCandidate}'`],
  ])candidateSource=replaceExactlyOnce(candidateSource,before,after);
  candidate.bytes=Buffer.from(candidateSource);
  const manifest=files.find(file=>file.name==='manifest.json');
  const value=JSON.parse(manifest.bytes.toString());value.name+=' Private';value.version_name=value.version+' browser-first-v2 live preview private';
  value.version='0.3.25';value.version_name='0.3.25 private live L0 / L1-gap0';
  if(labelMode){value.name+=` Hat Label ${labelMode} (UNQUALIFIED)`;value.version_name=value.version+` Hat Label ${labelMode} PRIVATE RESEARCH`;}
  if(diagnosticCandidate){value.name+=' Live Diagnostics (UNQUALIFIED)';value.version_name=value.version+' continuous score capture PRIVATE RESEARCH';}
  if(hybridCandidate){value.version='0.3.26';value.name+=' Hybrid Live (UNQUALIFIED)';value.version_name='0.3.26 L0 / H-SHADOW / H-LIVE PRIVATE';}
  if(xoCandidate){value.name+=xoCandidate==='A'?' XO Baseline A':' XO Candidate B (NO-GO)';value.version_name=value.version+` xo-${xoCandidate} UNVERIFIED DETECTOR PREVIEW`;}
  if(hatCandidate){value.name+=hatCandidate==='A'?' Hat Baseline A':' Hat Visual Recovery R';value.version_name=value.version+` hat-${hatCandidate} UNVERIFIED DETECTOR PREVIEW`;}
  manifest.bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');
}
for (const name of ['percussion-capability.js', 'percussion-classifier.js', 'causal-percussion-classifier.js', 'percussion-features.js', 'percussion-worklet.js',
  'percussion-worker.js', 'percussion-runtime.js', 'lead-audio-authorization.js', 'lead-audio-tap.js', 'lead-audio-worklet.js']) files.push({ name, bytes: await readFile(join(extension, name)) });
if(privateCandidate&&!xoCandidate&&!hatCandidate)files.push({name:'early-percussion-classifier.js',bytes:await readFile(join(extension,'early-percussion-classifier.js'))});
else {
  const worker=files.find(file=>file.name==='percussion-worker.js');
  let source=replaceExactlyOnce(worker.bytes.toString(),"import { EarlyPercussionClassifier } from './early-percussion-classifier.js';",'');
  source=replaceExactlyOnce(source,": config.classifier === 'early-finalization' ? new EarlyPercussionClassifier(config.thresholds, { diagnostics: config.diagnostics === true })",'');
  worker.bytes=Buffer.from(source);
  const runtime=files.find(file=>file.name==='percussion-runtime.js');
  runtime.bytes=Buffer.from(replaceExactlyOnce(runtime.bytes.toString(),",'early-finalization'",''));
}
// Reject broken runtime imports before writing either the ZIP or desktop bundle.
// MODEL-NOTICE records restrictions; inclusion does not establish release rights.
for (const name of ['generated/percussion/percussion.json', 'generated/percussion/percussion.onnx',
  'vendor/percussion/ort.wasm.min.mjs', 'vendor/percussion/ort-wasm-simd-threaded.mjs',
  'vendor/percussion/ort-wasm-simd-threaded.wasm', 'MODEL-NOTICE.txt']) {
  files.push({ name, bytes: await readFile(join(extension, name)) });
}
if(hybridCandidate){
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const model=await readFile(join(root,'scratch/beat-grid-v2/sources/C1/webUI/drum_cnn.onnx'));
  if(digest(model)!=='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db')throw Error('Frozen CNN B mismatch');
  const adtof=files.find(file=>file.name==='generated/percussion/percussion.onnx');
  if(digest(adtof.bytes)!=='c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a')throw Error('Frozen ADTOF mismatch');
  const vendor=join(root,'scratch/cnn-live-recovery/vendor/wasm-audio-resampler-2.0.0/package');
  const glue=await readFile(join(vendor,'app/soxr_wasm.js'),'utf8');
  const sources={
    'hybrid-pcm-worklet.js':join(extension,'hybrid-pcm-worklet.js'),
    'hybrid-cnn-worker.js':join(extension,'hybrid-cnn-worker.js'),
    'hybrid-frontend.mjs':join(root,'scripts/cnn-browser-frontend.mjs'),
    'hybrid-soxr.mjs':join(root,'scripts/research-cnn-live/soxr-wasm-adapter.mjs'),
    'hybrid-source-guard.mjs':join(root,'scripts/research-cnn-live/source-segment-guard.mjs'),
    'generated/hybrid/coefficients.json':join(root,'scratch/cnn-live-recovery/run/coefficients.json'),
    'generated/hybrid/soxr_wasm.wasm':join(vendor,'app/soxr_wasm.wasm'),
    'generated/hybrid/WRAPPER-LICENSE.txt':join(vendor,'LICENSE'),
    'generated/hybrid/CNN-SOURCE-LICENSE.txt':join(root,'scratch/beat-grid-v2/sources/C1/LICENSE'),
    'generated/hybrid/CNN-README.source.txt':join(root,'scratch/beat-grid-v2/sources/C1/README.source.txt'),
  };
  for(const [name,path]of Object.entries(sources)){
    let bytes=await readFile(path);
    if(name==='hybrid-cnn-worker.js')bytes=Buffer.from(bytes.toString()
      .replace('../../scripts/cnn-browser-frontend.mjs','./hybrid-frontend.mjs')
      .replace('../../scripts/research-cnn-live/soxr-wasm-adapter.mjs','./hybrid-soxr.mjs')
      .replace('../../scripts/research-cnn-live/source-segment-guard.mjs','./hybrid-source-guard.mjs'));
    files.push({name,bytes});
  }
  files.push({name:'generated/hybrid/model.onnx',bytes:model});
  files.push({name:'generated/hybrid/soxr-glue.mjs',bytes:Buffer.from('const exports = {};\n'+glue.replace(/\/\/# sourceMappingURL=.*$/m,'')+'\nexport default exports.default;')});
  files.push({name:'generated/hybrid/RESEARCH-NOTICE.txt',bytes:Buffer.from('Private local experiment only. No public redistribution clearance. CNN source repository includes AGPL-3.0 (included); checkpoint permission and STAR training-data rights/redistribution scope still require verification. ADTOF MODEL-NOTICE restrictions remain. SoXR wrapper MIT license included; underlying SoXR LGPL source/relinking obligations remain unresolved for redistribution. ONNX Runtime 1.30.0 vendor header declares Microsoft MIT; full release notices/source obligations must accompany any redistribution. No research audio is bundled. Running normalization differs from frozen whole-track preprocessing; strict feature parity A_PARTIAL. PHYSICAL_AV_SYNC_NOT_VERIFIED.\n')});
  files.push({name:'generated/hybrid/package-provenance.json',bytes:Buffer.from(JSON.stringify({
    version:1,privateLocalEvaluationOnly:true,modelSha256:digest(model),adtofSha256:digest(adtof.bytes),
    canonicalFrontend:'scripts/cnn-browser-frontend.mjs',normalization:'observed-only running maximum',strictParity:'A_PARTIAL',audioBundled:false,
    assets:files.map(({name,bytes})=>({name,bytes:bytes.length,sha256:digest(bytes)})),
  },null,2))});
}
const packagedNames = new Set(files.map(({ name }) => name));
for (const { name, bytes } of files.filter(({ name }) => name.endsWith('.js'))) {
  for (const match of bytes.toString().matchAll(/from\s+["']\.\/([^"']+)["']/g)) {
    if (!packagedNames.has(match[1])) throw new Error(`Missing Companion dependency: ${name} → ${match[1]}`);
  }
}
JSON.parse(files.find((file) => file.name === 'manifest.json').bytes.toString());
await mkdir(output, { recursive: true });
const archive = zip(files);
await writeFile(join(output, 'kanban-music-companion.zip'), archive);
await writeFile(join(output, 'kora-music-companion.zip'), archive);

// Ship only runtime files with Windows, already unpacked for Load unpacked.
const bundledCompanion = privateCandidate ? output : join(root, 'src-tauri', 'generated', 'music-companion');
for (const { name, bytes } of files) {
  const target = join(bundledCompanion, 'extension', name);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, bytes);
}
const manifest = JSON.parse(files.find((file) => file.name === 'manifest.json').bytes.toString());
const setup = await readFile(join(root, 'src-tauri', 'companion-setup.html'), 'utf8');
await writeFile(join(bundledCompanion, 'Install Music Companion.html'), setup.replaceAll('__COMPANION_VERSION__', manifest.version));
if(privateCandidate)await writeFile(join(output,'Private listening guide.html'),`<!doctype html><meta charset="utf-8"><title>Private Beat Grid candidate</title>
<body style="max-width:850px;margin:50px auto;font:18px/1.6 system-ui"><h1>Private Beat Grid candidate</h1>
<p>Local experiment. Accuracy, model release rights, physical synchronization and user listening acceptance remain unverified. Do not publish this package.</p>
<p>Use one Kora Music grid owner in this browser while testing. Close other Music grids; simultaneous ownership is not qualified.</p>
<ol><li>In Chrome or Edge, open the Extensions page, enable developer mode, choose Load unpacked and select the adjacent <b>extension</b> folder. Check version ${manifest.version}, name Kora Music Companion Private.</li>
<li>In the repository, run <code>node scripts/prepare-beat-corpus.mjs</code> then <code>node scripts/verify-private-companion.mjs --serve</code>. Keep that terminal open; Ctrl+C stops the local server.</li>
<li>Open <a href="http://127.0.0.1:5173">the private grid</a> and <a href="http://127.0.0.1:5174">the audio-only review tab</a>. Choose authorized local audio, press Play, and click Companion's toolbar icon on that source tab.</li>
<li>In the grid, wait for calibration, pause the source, open Private candidate and complete the consent checks. Enable the bounded delay and optional unverified instrument preview, then resume. The mode shows the actual intentional delay.</li>
<li>For YouTube or another supported captured tab, play it, click Companion on that source tab, then select it in the grid. Under Live preview, complete the three checks and click Enable live preview (no audio delay) while playback continues. No calibration is required. The mode is experimental-live; model flashes can be late or incorrect. Pause, seek or source changes end preview; enable it again while playing. Reload the private extension and grid after updating this package.</li>
<li>Use pause, seek and source changes to investigate. A source/generation change revokes the experiment. Video, uncertain output, native capture and Spotify cannot enable this buffer.</li>
<li>Report the approximate song time, row and observed failure. Provisional annotations remain investigation-only. Generic degraded visuals make no instrument claim.</li></ol>
<p>No web deployment, extension-store update or installer publication is included. Model weights remain local evaluation assets.</p></body>`);
if(privateCandidate&&!xoCandidate&&!hatCandidate&&!hybridCandidate)await writeFile(join(output,'Private listening guide.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Kora private L0 / L1 listening</title>
<body style="max-width:850px;margin:40px auto;padding:20px;font:18px/1.6 system-ui"><h1>Private live L0 / L1 listening</h1>
<p>Local evaluation only. L0 remains the default. L1 is earlier ADTOF peak finalization, not offline H0 or a new model. Recognition, physical synchronization, resource qualification and user acceptance are incomplete. Do not publish.</p>
<ol><li>Use the browser with your working Companion (Brave in this session). Reload this unpacked extension, verify <b>Kora Music Companion Private ${manifest.version}</b>, then refresh the music source and Kora. Enable only one Companion and one Kora grid.</li>
<li>From the repository, reuse the private server on <b>127.0.0.1:1420</b>. If stopped, run <code>node scripts/serve-hybrid-beta.mjs</code> and keep the terminal open. Open <a href="http://127.0.0.1:1420/music">Kora Music</a>.</li>
<li>Play an authorized, unprotected source. Click Companion on that source tab, select it in Kora and open <b>Music → Private candidate → Live preview</b>. Spotify and protected Apple Music remain blocked for semantic analysis.</li>
<li>Keep playback running. Confirm the three permission, audible-output and experimental-preview statements only if true. Select <b>L0 · Frozen live ADTOF baseline</b> and enable <b>live preview (no audio delay)</b>. Calibration and intentional buffering are not required.</li>
<li>Compare the same passage using <b>L1 · Earlier peak finalization (experimental)</b>. Confirm <b>LIVE SEMANTIC CANDIDATE — EXPERIMENTAL</b>. Switch to L0 in the same selector for rollback. The original audio is not delayed or sped up.</li>
<li>Pause, seek or change source to revoke preview; reactivate while playing. Record approximate song time, row, missed/repeated/incorrect flashes and uncertainty. Your observations remain provisional references, never official precision/recall.</li></ol>
<p>L1 improved software p95 by about 10–24 ms in controlled comparisons, with some worse tails. Physical speaker-to-pixel synchronization remains UNVERIFIED. No deployment, installer or store update is included.</p></body></html>`);
if(hybridCandidate)await writeFile(join(output,'Private listening guide.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Kora private Hybrid Live</title>
<body style="max-width:900px;margin:40px auto;padding:20px;font:18px/1.6 system-ui"><h1>Private Hybrid Live — UNQUALIFIED</h1>
<p>Version ${manifest.version}. Local owner evaluation only. H-LIVE uses frozen ADTOF Kick/Snare and frozen CNN B Hi-Hat with experimental running normalization. It is not exact offline H0. Recognition and physical timing are unqualified; do not distribute this package.</p>
<ol><li>Use one Companion and one Kora Music owner. In your browser Extensions page, load the adjacent <b>extension</b> folder (or reload this existing private copy). Verify <b>Kora Music Companion Private Hybrid Live (UNQUALIFIED)</b>, version <b>${manifest.version}</b>. Refresh Kora and the source tab after updating. No installed extension is changed by building this folder.</li>
<li>Reuse the repository's private server on port1420; if stopped, run <code>node scripts/serve-hybrid-beta.mjs</code>. Open <a href="http://127.0.0.1:1420/focus?tab=music&musicDebug=1">Kora Music</a>.</li>
<li>Play an authorized unprotected source tab, click its Companion toolbar action, then select that source in Kora. YouTube/provider hardware behavior still requires owner testing. Existing Spotify/protected-source and native-capture restrictions remain; those routes are not qualified here. Use playback speed1x.</li>
<li>Open <b>Music → Private candidate → Audio Delay Compensation — Experimental</b>. Pause the source. Select <b>H-LIVE</b> in Compensated detector, choose <b>170 ms</b>, complete the existing output/permission consent only if true, then press <b>Enable 170 ms compensation</b>. Resume playback and open <b>Beat grid</b>. This uses the existing audible output route. 170 ms is an experiment, not a calibrated recommendation.</li>
<li><b>L0</b> is the original ADTOF baseline. <b>H-SHADOW</b> computes CNN Hat and retains bounded observations while displaying L0. <b>H-LIVE</b> displays only CNN Hat, with ADTOF Kick/Snare and existing Bass/Lead. No hidden ADTOF Hat fallback is used when CNN fails.</li>
<li>For0ms, leave compensation OFF; under <b>Live instrument preview</b> select the detector, complete all three existing consents, and enable no-delay preview while playing. Future context and processing still make decisions late. For150/170/200/250ms comparisons, disable compensation, pause and select the next preset explicitly.</li>
<li>In Beat grid/debug, under <b>Private Live failure capture</b>, press <b>Record30 seconds</b>, wait for completion, then <b>Export row trace</b>. Record source title and approximate song interval. The export includes both model score streams and delivery stages; it contains no captured audio. Incomplete exports and resets remain evidence, not successful uninterrupted captures.</li>
<li>Pause/resume preserves the chosen compensated detector. Seek, source replacement or clock invalidation revokes compensation; re-enable for the new source only when valid. To roll back, disable compensation/preview and select L0. Only one route remains audible; hardware output buffers cannot be retracted.</li></ol>
<p>PHYSICAL_AV_SYNC_NOT_VERIFIED. Software timestamps do not measure speaker-to-pixel offset. Strict tensor parity remains A_PARTIAL; Hat events remain predictions, not verified Closed/Open attacks. No public routing, installer, deployment or Beat Grid visual changes are included.</p></body></html>`);
if(hatCandidate){
 const guide=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Hat playback A/R listening</title>
 <body style="max-width:900px;margin:40px auto;padding:20px;background:#18181c;color:#eee;font:18px/1.6 system-ui">
 <h1>UNVERIFIED DETECTOR PREVIEW — A / R</h1>
 <p><b>A:</b> current baseline detector and visuals. <b>R:</b> the same detector with a 40 ms Hat visual transient.
 R changes visualization only. It cannot recover a Hat/Snare that the model never predicts, and does not certify accurate or physically synchronized music detection.
 Previous detector B remains rejected and disabled.</p>
 <ol><li>In Chrome or Edge, open Extensions, disable all other Kora Music Companions, enable Developer mode and Load unpacked from
 <code>scratch/hat-playback-discrepancy/candidate-A/extension</code> or <code>scratch/hat-playback-discrepancy/candidate-R/extension</code> in this repository.
 Verify the name <b>Kora Music Companion Private Hat Baseline A</b> or <b>Hat Visual Recovery R</b>. Enable only one version and keep one grid open.</li>
 <li>Use the existing local server, <code>node scripts/verify-private-companion.mjs --serve</code>, on fixed ports 5173/5174.
 Reuse it if running. Open <a href="http://127.0.0.1:5173/">Private Grid</a> and <a href="http://127.0.0.1:5174/">authorized audio-only source</a> in the same browser.</li>
 <li>Choose Downloads/<code>Lil Uzi Vert - XO Tour Llif3 (Official Lyric Video).mp3</code>.
 SHA-256 <code>98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05</code>.
 Start the original full file at zero, rate 1, using the same device/volume for A and R. Play and click Companion's toolbar icon on that source tab.</li>
 <li>Select <b>Authorized audio-only review</b> in the grid. Listen to captured output, let calibration collect samples, and Pause before source second 45.</li>
 <li>Open Private candidate. Confirm all four checks only if true: authorization; captured output audible with no echo/second playback;
 intentional delay accepted; <b>Show unverified instrument predictions during buffered playback</b>.
 Enable <b>calibrated 500 ms delay</b> while paused. Incomplete or over-budget calibration remains blocked.</li>
 <li>Confirm the expected A/R heading, <b>experimental-buffered</b>, intentional delay <b>500 ms</b>, and enabled typed preview.
 Resume through <b>45–57 seconds</b>, keeping the grid visible. Do not seek after enabling; source/generation changes revoke preview.
 Keep heavy builds and other CPU-intensive work stopped during this clean comparison.</li>
 <li>Pause, switch extensions, reload both local pages and repeat from zero with identical settings.
 R only shortens the Hat flash and removes underlying Hat decorative fill that can obscure retriggers.
 Twenty-to-thirty ms activity can still fuse; reduced motion intentionally shows sustained activity instead of rapid flashes.</li></ol>
 <p>For the same passage, report which applies: several audible Hats but continuous brightness; audible Hat without a flash;
 flash without a confidently audible Hat; flash late relative to sound; instrument identity uncertain.
 An approximate moment is enough. No millisecond-complete labels are needed, and listening observations are not official onset-scoring ground truth.</p>
 <p>Timing and recognition remain experimental. The bounded CPU test expired and reacquired capture, reset the output clock and revoked buffered typed preview.
 Audio continuity during that transition is unverified. Pause and re-establish capture/calibration after degradation; this comparison does not qualify tracking under load.
 Spotify and synchronized-video buffering restrictions remain unchanged. The goal of R is clearer representation of accepted activity, not more predicted notes.</p>
 <p>No public release or deployment. The local evidence and technical report retain FAIL/BLOCKED gates.</p></body></html>`;
 await writeFile(join(output,'Private listening guide.html'),guide);
 await writeFile(join(root,'scratch','hat-playback-discrepancy','ar-listening-guide.html'),guide);
}
if(xoCandidate){
  const guide=`<!doctype html><html lang="en"><meta charset="utf-8"><title>XO private A/B listening</title>
  <body style="max-width:900px;margin:40px auto;padding:20px;background:#18181c;color:#eee;font:18px/1.6 system-ui">
  <h1>UNVERIFIED DETECTOR PREVIEW</h1><p><b>Baseline A / Candidate B — B is NO-GO for adoption.</b>
  Controlled 50 ms Hats improve, but Snare-only false Hats increase. Natural accuracy and physical synchronization remain unverified.</p>
  <p>Use Chrome or Edge on this computer. Enable only one Kora Music Companion extension at a time and keep one grid open.</p>
  <ol><li>Open <code>edge://extensions</code> or <code>chrome://extensions</code>, disable the current Companion and the other comparison version,
  enable Developer mode, then Load unpacked from <code>scratch/xo-percussion-recovery/candidate-A/extension</code> or
  <code>scratch/xo-percussion-recovery/candidate-B/extension</code> within this repository.
  Verify the extension name says <b>XO Baseline A</b> or <b>XO Candidate B (NO-GO)</b>. Reload it after rebuilding.</li>
  <li>The review server uses <a href="http://127.0.0.1:5173/">the private grid</a> and
  <a href="http://127.0.0.1:5174/">the audio-only source tab</a>. If they refuse connection, start
  <code>node scripts/verify-private-companion.mjs --serve</code> in the repository and keep the terminal open. Reuse an existing server on these ports.</li>
  <li>Choose <code>Lil Uzi Vert - XO Tour Llif3 (Official Lyric Video).mp3</code> from Downloads in the audio-only tab.
  SHA-256: <code>98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05</code>.
  Use the full original file, starting at zero, playback rate 1. Keep the same device, volume and browser for both runs.</li>
  <li>Play the source, then click Companion's toolbar icon on that source tab. Select <b>Authorized audio-only review</b> in the grid.
  Listen to the captured output. Let calibration collect enough samples, then use grid Pause before song second 45.</li>
  <li>Open Private candidate and check all four controls: permission to use this audio; captured output audible with no echo/second playback;
  acceptance of intentional delay; <b>Show unverified instrument predictions during buffered playback</b>.
  Only confirm statements that are true for your session. Click <b>Enable calibrated 500 ms delay</b> while paused.
  If disabled, follow its exact reason; incomplete/out-of-budget calibration requires more playback and another pause.</li>
  <li>Verify <b>experimental-buffered</b>, intentional delay <b>500 ms</b>, correct A/B label and enabled instrument preview.
  Click Play and watch Kick, Snare/Clap and Hi-hat/Cymbal during <b>45–57 seconds</b>.
  Keep the grid visible. Do not seek after enabling; seeking/source/generation changes revoke preview.</li>
  <li>Pause, disable A, enable B (or reverse), reload both local pages and repeat from zero using the same source/settings.
  Do not run both extensions together. Switch back to A or the prior private package afterward; B is diagnostic only.</li></ol>
  <p>This audio-only comparison does not authorize delaying synchronized video. Spotify and existing video/output guards remain in force.
  For the previously implemented zero-delay platform preview, use its separate Live preview controls; it is not this matched-buffer comparison.</p>
  <h2>Listening feedback</h2><ol><li>Are Snare/Clap hits less frequently missed?</li><li>Are repeated Hats more consistently represented?</li>
  <li>Do audibly distinct attacks appear separately?</li><li>Are there more false Hat flashes?</li><li>Has Kick become worse?</li>
  <li>Does playback sound normal, without echo, pops or visible timing drift?</li></ol>
  <p>Include approximate song times and uncertain instrument identities. These observations remain provisional-human-reference, never official precision/recall.</p>
  <p>Trace mechanism in both builds: grid <code>window.candidate.telemetry.records</code>; privileged extension diagnostic message
  <code>{target:'beat-offscreen',kind:'percussion-diagnostics'}</code>. Generated acoustic fixtures and evidence stay in local scratch storage.
  No publication or deployment is included.</p></body></html>`;
  await writeFile(join(output,'Private listening guide.html'),guide);
  await writeFile(join(root,'scratch','xo-percussion-recovery','ab-listening-guide.html'),guide);
}
await writeFile(join(bundledCompanion, 'package-files.json'), JSON.stringify([
  ...files.map(({ name }) => `extension/${name}`), 'Install Music Companion.html',
], null, 2) + '\n');
console.log(`Music companion packaged: ${files.length} files → ${output}`);
