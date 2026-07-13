// Bundle-size budget (remediation plan §11 / Phase 5).
//
// Fails the build if the main entry chunk exceeds BUDGET_BYTES, so the main
// entry cannot silently grow back past 1 MB. Run after `vite build`:
//   node scripts/check-bundle-size.mjs
//
// Looks for the largest `dist/assets/index-*.js` file (the app entry) and
// also reports the total of all emitted JS.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = new URL('../dist/assets/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:\/)/, '');
const BUDGET_BYTES = 1_000_000; // 1 MB hard cap on the main entry chunk.

function listJsFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.js'))
      .map((name) => join(dir, name));
  } catch {
    console.error(`[bundle-size] No dist/assets found. Run "npm run build" first.`);
    process.exit(1);
  }
}

const jsFiles = listJsFiles(DIST_DIR);
if (jsFiles.length === 0) {
  console.error('[bundle-size] No JS chunks found in dist/assets.');
  process.exit(1);
}

const sized = jsFiles
  .map((file) => ({ file, bytes: statSync(file).size }))
  .sort((a, b) => b.bytes - a.bytes);

const main = sized.find((entry) => /(^|[/\\])index-[^/\\]+\.js$/.test(entry.file)) || sized[0];
const totalBytes = sized.reduce((sum, entry) => sum + entry.bytes, 0);

const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const mainName = main.file.split(/[/\\]/).pop();

console.log(`[bundle-size] main entry  ${mainName}: ${fmt(main.bytes)} (budget ${fmt(BUDGET_BYTES)})`);
console.log(`[bundle-size] total JS   ${fmt(totalBytes)} across ${sized.length} chunks`);

if (main.bytes > BUDGET_BYTES) {
  console.error(`[bundle-size] FAIL: main entry ${fmt(main.bytes)} exceeds ${fmt(BUDGET_BYTES)}.`);
  process.exit(1);
}

console.log('[bundle-size] OK: within budget.');
