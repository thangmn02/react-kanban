// Browser verification of real MELODIA fixtures; makes no musical acceptance claim.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const directory = 'src-tauri/target/generalized-melody';
const report = JSON.parse(await readFile(`${directory}/melodia-report.json`, 'utf8'));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  await page.getByLabel('Melody stream', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.beat-square').length === 40);
  const audio = page.locator('audio');
  for (const id of report.selected) {
    const index = report.cases.findIndex(c => c.id === id), entry = report.cases[index];
    await page.getByLabel('Excerpt', { exact: true }).selectOption(String(index));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    await page.getByLabel('Melody stream', { exact: true }).selectOption('melodia');
    const note = entry.melodia.notes.find(n => n.start > .15);
    await audio.evaluate((a, target) => { a.pause(); a.currentTime = target; }, note.start-.15);
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
    await page.waitForFunction(target => {
      const flash = document.querySelector('[data-channel="melody"] [data-beat-trace]');
      return flash && Math.abs(Number(flash.dataset.targetPlaybackTime)-target) < .00001;
    }, note.start, { timeout: 4000 });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Incorrect timing', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export row trace', exact: true }).click();
    const path = `${directory}/${id}/melodia/browser-trace.json`;
    await (await download).saveAs(path);
    const trace = JSON.parse(await readFile(path, 'utf8'));
    if (!trace.rows.melody.length || trace.flashes.some(e => e.row !== 5 || !e.semantic)) throw new Error(`${id}: wrong row`);
    if (trace.rows.melody.some(e => e.version !== entry.melodia.version || e.audioSha256 !== entry.audioSha256
      || !Number.isFinite(e.midiPitch) || !Number.isFinite(e.actualPlaybackTime) || e.selectedSource !== 'original-mixture')) throw new Error(`${id}: wrong provenance`);
    if (new Set(trace.rows.melody.map(e => e.eventId)).size !== trace.rows.melody.length) throw new Error(`${id}: duplicate event`);
    const offsets = trace.flashes.filter(e => e.stage === 'animation').map(e => (e.actualPlaybackTime-e.targetPlaybackTime)*1000);
    if (!offsets.length || offsets.some(ms => ms < -80 || ms > 250)) throw new Error(`${id}: animation deadline`);
    await audio.evaluate(a => a.pause());
    await page.waitForFunction(() => !document.querySelector('[data-beat-trace]'));
    const paused = await audio.evaluate(a => a.currentTime);
    await page.waitForTimeout(300);
    if (Math.abs((await audio.evaluate(a => a.currentTime))-paused) > .005) throw new Error(`${id}: pause`);
    checks.push({ id, target: note.start, committed: trace.rows.melody.length, animationOffsetMs: offsets,
      markers: trace.markers.length, version: trace.fixture.version });
  }
  // Same one-player clock across v3, rejected candidate and MELODIA audio modes.
  await audio.evaluate(a => { a.currentTime = 10; });
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  for (const [label, stream] of [['MELODIA + attack clicks', 'melodia'], ['Preserved v3 + clicks', 'v3'], ['Candidate + attack clicks', 'candidate'], ['MELODIA continuous F0', 'melodia']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    if (await page.getByLabel('Melody stream', { exact: true }).inputValue() !== stream || await audio.count() !== 1
      || Math.abs((await audio.evaluate(a => a.currentTime))-10) > .02 || !await audio.evaluate(a => a.paused)) throw new Error(`Audition mismatch: ${label}`);
    if (await page.locator('[data-beat-trace]').count()) throw new Error('Paused switch produced stale flash');
  }
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
  const first = report.cases.at(-1).melodia.notes.find(n => n.start > .15);
  await audio.evaluate((a, time) => { a.currentTime = time; }, first.start-.15);
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-beat-trace]'));
  await audio.evaluate(a => { a.currentTime = 24; });
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  await page.waitForTimeout(100);
  const targets = await page.locator('[data-beat-trace]').evaluateAll(elements => elements.map(e => Number(e.dataset.targetPlaybackTime)));
  if (targets.some(t => t < 24)) throw new Error('Seek retained stale targets');
  await audio.evaluate(a => a.pause());
  const notAnalyzed = report.cases.findIndex(c => !c.melodia);
  await page.getByLabel('Excerpt', { exact: true }).selectOption(String(notAnalyzed));
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
  await page.waitForFunction(() => document.querySelector('#melody-stream option[value="melodia"]').disabled);
  const disabled = await page.evaluate(() => ({ option: document.querySelector('#melody-stream option[value="melodia"]').disabled,
    button: document.querySelector('[data-mode="melodia/primary-clicks"]').disabled }));
  if (!disabled.option || !disabled.button) throw new Error(`Unanalyzed fixture silently enabled: ${JSON.stringify(disabled)}`);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: `${directory}/melodia-browser.png`, fullPage: true });
  await writeFile(`${directory}/melodia-browser-check.json`, JSON.stringify({ errors, checks, cells: 40, audioElements: 1,
    checksPassed: ['real targets', 'row5-only', 'source/pitch/hash export', 'markers', 'pause', 'replay/backward seek', 'forward seek', 'three-stream audition switch', 'unavailable stream disabled'],
    musicalAcceptance: 'pending-human-listening' }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); }
