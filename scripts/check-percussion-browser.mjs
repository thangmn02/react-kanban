// Own isolated browser profile; no access to the user's Edge tabs or cookies.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), target = join(root, 'src-tauri/target/learned-percussion');
const extension = join(target, 'companion');
const context = await chromium.launchPersistentContext(join(target, 'browser-profile'), {
  channel: 'msedge', headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--autoplay-policy=no-user-gesture-required'],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/setup.html`);
  const audio = (await readFile(join(target, 'browser-control.wav'))).toString('base64');
  const result = await page.evaluate(async audio => {
    const { createPercussionRuntime } = await import('./percussion-runtime.js');
    const { beatTelemetry } = await import('./beat-telemetry.js');
    beatTelemetry.enable(); beatTelemetry.clear();
    const context = new AudioContext({ sampleRate: 44100 });
    await context.resume();
    const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const buffer = await context.decodeAudioData(bytes.buffer);
    const source = context.createBufferSource(); source.buffer = buffer;
    const events = [], began = performance.now();
    const runtime = await createPercussionRuntime({ context, source, onEvent: e => events.push({ ...e, deliveredAt: context.currentTime, delayMs: (context.currentTime-e.audioTime)*1000 }) });
    if (!runtime) { await context.close(); return { failure: 'runtime unavailable', telemetry: beatTelemetry.snapshot() }; }
    const startupMs = performance.now()-began;
    source.start();
    await new Promise(resolve => { source.onended = resolve; });
    await new Promise(resolve => setTimeout(resolve, 300));
    runtime.stop(); await context.close();
    return { browser: navigator.userAgent, startupMs, duration: buffer.duration, events, telemetry: beatTelemetry.snapshot() };
  }, audio);
  await writeFile(join(target, 'browser-check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, events: result.events?.length, telemetry: result.telemetry?.counts }));
  if (result.failure || !result.events?.length) throw new Error('Real learned browser inference produced no percussion');
} finally { await context.close(); }
