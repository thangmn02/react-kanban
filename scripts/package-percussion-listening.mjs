// Private learned-model experiment. Does not modify public downloads or releases.
import { readdir, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { output: { type: 'string' }, model: { type: 'string' }, 'step-frames': { type: 'string' }, 'right-context': { type: 'string' }, name: { type: 'string' } } });
const output = resolve(root, values.output || 'src-tauri/target/learned-percussion/companion');
if (!output.startsWith(join(root, 'src-tauri', 'target') + sep)) throw new Error('Private bundle must stay in target');
const model = resolve(root, values.model || 'src-tauri/target/learned-percussion/model');
const source = join(root, 'extensions/kanban-music');
await mkdir(output, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isFile() && /\.(js|json|html|css)$/.test(entry.name) && !entry.name.includes('.test.'))
    await copyFile(join(source, entry.name), join(output, entry.name));
}
await mkdir(join(output, 'icons'), { recursive: true });
for (const name of ['16.png', '48.png', '128.png']) await copyFile(join(source, 'icons', name), join(output, 'icons', name));
const config = JSON.parse(await readFile(join(model, 'percussion.json')));
if (values['step-frames']) config.stepFrames = Number(values['step-frames']);
if (values['right-context']) config.rightContext = Number(values['right-context']);
if (![2, 5, 10].includes(config.stepFrames) || !(config.classifier === 'causal' ? [0] : [2, 4, 6, 10]).includes(config.rightContext)) throw new Error('Invalid streaming profile');
const bytes = await readFile(join(model, 'percussion.onnx'));
if (createHash('sha256').update(bytes).digest('hex') !== config.sha256) throw new Error('Model integrity mismatch');
await mkdir(join(output, 'generated/percussion'), { recursive: true });
await copyFile(join(model, 'percussion.onnx'), join(output, 'generated/percussion/percussion.onnx'));
await writeFile(join(output, 'generated/percussion/percussion.json'), JSON.stringify(config));
await mkdir(join(output, 'vendor/percussion'), { recursive: true });
for (const name of ['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'])
  await copyFile(join(root, 'node_modules/onnxruntime-web/dist', name), join(output, 'vendor/percussion', name));
const manifest = JSON.parse(await readFile(join(output, 'manifest.json')));
manifest.name = values.name || 'Kora Music Companion — Learned Percussion Test';
manifest.version_name = `${manifest.version} · learned percussion test`;
manifest.content_security_policy = { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" };
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(join(output, 'MODEL-NOTICE.txt'),
  `Local evaluation only. ADTOF model or private distilled derivative: CC-BY-NC-SA-4.0 rights unresolved.\nWeights: ${config.weightsSource}\nModel SHA256: ${config.sha256}\nPseudo labels are not human ground truth. Do not publish as a commercial release without resolving model rights.\n`);
console.log(output);
