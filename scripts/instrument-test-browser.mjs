import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { models, loadModel } from '../extensions/kanban-music/instrument-models.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const modelDir = resolve(repo, process.env.KORA_TEST_MODEL_DIR || 'scratch/instrument-proof');
export async function withInstrumentBrowser(verify) {
  await mkdir(modelDir, { recursive: true });
  for (const model of models) {
    const file = resolve(modelDir, `${model.name}.onnx`);
    try { await readFile(file); }
    catch {
      console.log(`Downloading ${model.name} model (${(model.bytes / 1e6).toFixed(1)} MB)`);
      await writeFile(file, await loadModel(model));
    }
  }
  const server = http.createServer(async (request, response) => {
    try {
      // Exercise the same executable-code policy as the packaged MV3 pages.
      response.setHeader('Content-Security-Policy', "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      if (path === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Local instrument verification</title>'); return; }
      let file;
      if (/^\/models\/(vocals|drums|bass|other)\.onnx$/.test(path)) file = resolve(modelDir, path.slice(8));
      else if (path.startsWith('/extensions/kanban-music/') && /\.(js|mjs|wasm)$/.test(path)) {
        file = resolve(repo, '.' + path);
        if (!file.startsWith(resolve(repo, 'extensions/kanban-music') + '\\') && !file.startsWith(resolve(repo, 'extensions/kanban-music') + '/')) throw Error('Path');
      } else if (/^\/fixtures\/fixture-\d+-(other|vocals|drums|bass|mixture)\.f32$/.test(path)) file = resolve(modelDir, path.slice(10));
      else throw Error('Path');
      response.setHeader('Content-Type', /\.(js|mjs)$/.test(file) ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(1431, '127.0.0.1', done); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.KORA_TEST_BROWSER || 'chrome', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
    const page = await browser.newPage(); await page.goto('http://127.0.0.1:1431/');
    await page.evaluate(async () => {
      const { models, modelCache } = await import('/extensions/kanban-music/instrument-models.js');
      const cache = await caches.open(modelCache);
      for (const model of models) await cache.put(model.url, await fetch(`/models/${model.name}.onnx`));
    });
    return await verify(page);
  } finally { await browser?.close(); await new Promise(done => server.close(done)); }
}
