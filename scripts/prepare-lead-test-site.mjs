import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Separate base directory/configuration; never deploy the application dist.
const root = resolve('src-tauri/target/lead-cache-replay');
if (process.argv.includes('--probe')) {
  const output = resolve(root, 'netlify-edge-probe');
  await mkdir(resolve(output, 'public'), { recursive: true });
  await mkdir(resolve(output, 'netlify/edge-functions'), { recursive: true });
  await mkdir(resolve(output, 'gate'), { recursive: true });
  await mkdir(resolve(output, 'no-functions'), { recursive: true });
  await writeFile(resolve(output, 'public/index.html'), '<!doctype html><title>Kora protected Edge probe</title><h1>Protected packaging probe</h1><p>No audio or analysis is included.</p>');
  await writeFile(resolve(output, 'public/probe.txt'), 'KORA_PROTECTED_EDGE_PROBE_V1\n');
  await writeFile(resolve(output, 'public/probe.bin'), Uint8Array.from({ length: 1024 }, (_, i) => i % 256));
  await copyFile(resolve('scripts/lead-test-edge-auth.mjs'), resolve(output, 'gate/auth.mjs'));
  await writeFile(resolve(output, 'netlify/edge-functions/auth.js'), `import { createAuthGate } from '../../gate/auth.mjs';
export default async (request, context) => {
  const query = new URL(request.url).searchParams;
  // Harmless probe only: verify caught and uncaught runtime failures on real assets.
  if (query.get('edgeUncaught') === '1') throw new Error('Intentional packaging probe failure');
  return createAuthGate(() => {
    if (query.get('edgeFault') === '1') throw new Error('Intentional environment read failure');
    return { digest: Netlify.env.get('KORA_AUDIO_TEST_CREDENTIAL_SHA256'), siteId: Netlify.env.get('KORA_AUDIO_TEST_SITE_ID') };
  })(request, context);
};
export const config = { path: '/*', onError: 'fail' };
`);
  await writeFile(resolve(output, 'public/_headers'), `/*
  Cache-Control: private, no-store, max-age=0
  CDN-Cache-Control: no-store
  Netlify-CDN-Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
`);
  await writeFile(resolve(output, 'validate-probe.mjs'), `import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files = readdirSync('public').sort();
if (JSON.stringify(files) !== JSON.stringify(['_headers','index.html','probe.bin','probe.txt'])) throw Error('Unexpected published content');
if (readFileSync('public/probe.txt','utf8') !== 'KORA_PROTECTED_EDGE_PROBE_V1\\n') throw Error('Changed probe');
if (readFileSync('public/probe.bin').length !== 1024) throw Error('Changed binary');
console.log('Validated harmless probe package');
`);
  await writeFile(resolve(output, 'netlify.toml'), `[build]
  base = ${JSON.stringify(output.replaceAll('\\', '/'))}
  command = "node validate-probe.mjs"
  publish = "public"
  edge_functions = "netlify/edge-functions"
  functions = "no-functions"
`);
  console.log(JSON.stringify({ preparedProbe: true, directory: output, audioIncluded: false }));
  process.exit(0);
}
const source = resolve(root, 'https-source');
const output = resolve(root, 'netlify-test-site');
const asset = JSON.parse(await readFile(resolve(source, 'test-asset.json'), 'utf8'));
if (asset.asset.provider !== 'kora-development' || !/^[a-f0-9]{64}$/.test(asset.asset.id)
  || asset.audioPath !== `/kora-lead-test/${asset.asset.id}.wav`) throw new Error('Invalid development audio identity');
const audio = await readFile(resolve(source, `.${asset.audioPath}`));
if (createHash('sha256').update(audio).digest('hex') !== asset.asset.id) throw new Error('Audio identity mismatch');
await mkdir(resolve(output, 'public/kora-lead-test'), { recursive: true });
await mkdir(resolve(output, 'netlify/edge-functions'), { recursive: true });
await mkdir(resolve(output, 'no-functions'), { recursive: true });
await copyFile(resolve(source, 'index.html'), resolve(output, 'public/index.html'));
await writeFile(resolve(output, `public${asset.audioPath}`), audio);
await copyFile(resolve('scripts/lead-test-edge-auth.mjs'), resolve(output, 'netlify/edge-functions/auth.js'));
const html = await readFile(resolve(source, 'index.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!inline) throw new Error('Expected original player metadata script');
const scriptHash = createHash('sha256').update(inline).digest('base64');
await writeFile(resolve(output, 'public/_headers'), `/*
  Cache-Control: private, no-store, max-age=0
  CDN-Cache-Control: no-store
  Netlify-CDN-Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'none'; media-src 'self'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
`);
await writeFile(resolve(output, 'netlify.toml'), `[build]
  publish = "public"
  functions = "no-functions"
`);
console.log(JSON.stringify({ prepared: true, directory: output, asset: `${asset.asset.provider}:${asset.asset.id}`,
  publicFiles: ['index.html', asset.audioPath.slice(1), '_headers'], applicationIncluded: false }));
