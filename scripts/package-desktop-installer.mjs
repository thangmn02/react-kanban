import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(resolve(repo, 'src-tauri/tauri.conf.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid installer version.');
const source = resolve(repo, `src-tauri/target/release/bundle/nsis/Kora_${version}_x64-setup.exe`);
const target = resolve(repo, 'public/downloads/Kora-setup.exe');
const updateSignature = (await readFile(`${source}.sig`, 'utf8').catch(() => {
  throw new Error('Build with TAURI_SIGNING_PRIVATE_KEY before packaging an update.');
})).trim();
if (!/^[A-Za-z0-9+/=]+$/.test(updateSignature)) throw new Error('Invalid updater signature.');
const installer = await open(source, 'r').catch(() => {
  throw new Error(`Build Kora ${version} with npm run tauri build before packaging the download.`);
});
try {
  const signature = Buffer.alloc(2);
  await installer.read(signature, 0, 2, 0);
  if (signature.toString('ascii') !== 'MZ' || (await stat(source)).size < 1_000_000) {
    throw new Error('Installer is not a complete Windows executable.');
  }
} finally { await installer.close(); }
await mkdir(resolve(repo, 'public/downloads'), { recursive: true });
await copyFile(source, target);
await writeFile(resolve(repo, 'public/downloads/latest.json'), JSON.stringify({
  version,
  pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': {
    url: `https://kanthangboard.netlify.app/downloads/Kora-setup.exe?version=${version}`,
    signature: updateSignature,
  } },
}, null, 2) + '\n');
console.log(`Kora ${version} Windows installer staged at /downloads/Kora-setup.exe`);
