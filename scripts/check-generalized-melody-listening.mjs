// Isolated playback/artifact checks. Automated judgments are never listening evidence.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const directory = 'src-tauri/target/generalized-melody';
const cases = JSON.parse(await readFile(`${directory}/report.json`, 'utf8')).cases;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [], observations = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  for (let i = 0; i < cases.length; i++) {
    await page.getByLabel('Excerpt', { exact: true }).selectOption(String(i));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 2);
    for (const mode of ['original', 'primary-clicks', 'selected-pitches', 'baseline-audio/primary-clicks', 'baseline-audio/selected-pitches']) {
      if (mode !== 'original') await page.locator(`[data-mode="${mode}"]`).click();
      await page.waitForFunction(path => document.querySelector('audio').src.endsWith(path + '.wav') && document.querySelector('audio').readyState >= 2, mode);
      const duration = await page.locator('audio').evaluate(audio => audio.duration);
      if (Math.abs(duration - cases[i].duration) > .05) throw new Error(`Duration mismatch: ${cases[i].id}/${mode}`);
    }
    for (const source of ['vocals', 'piano', 'guitar', 'other']) {
      await page.getByLabel('Raw source', { exact: true }).selectOption(source);
      await page.getByRole('button', { name: 'Raw source pitches (polyphonic)', exact: true }).click();
      await page.waitForFunction(source => document.querySelector('audio').src.includes(`raw-${source}/selected-pitches.wav`) && document.querySelector('audio').readyState >= 2, source);
      const duration = await page.locator('audio').evaluate(audio => audio.duration);
      if (Math.abs(duration - cases[i].duration) > .05) throw new Error(`Raw synthesis duration mismatch: ${cases[i].id}/${source}`);
    }
    observations.push({ id: cases[i].id, modes: 9, duration: cases[i].duration });
  }
  await page.getByLabel('Excerpt', { exact: true }).selectOption('7');
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 2);
  await page.locator('audio').evaluate(audio => { audio.currentTime = 17; return audio.play(); });
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 17.15);
  const before = await page.locator('audio').evaluate(audio => audio.currentTime);
  await page.getByRole('button', { name: 'Preserved v3 + clicks', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').src.includes('baseline-audio/primary-clicks') && !document.querySelector('audio').paused);
  const after = await page.locator('audio').evaluate(audio => audio.currentTime);
  if (Math.abs(after-before) > .4) throw new Error('Comparison changed playback position');
  await page.locator('audio').evaluate(audio => audio.pause());
  await page.getByRole('button', { name: 'Candidate pitches', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').src.endsWith('/selected-pitches.wav') && document.querySelector('audio').readyState >= 2);
  if (!await page.locator('audio').evaluate(audio => audio.paused)) throw new Error('Mode switch resumed paused audio');
  await page.getByLabel('Overall judgment', { exact: true }).selectOption('failed');
  await page.getByLabel('Comments', { exact: true }).fill('AUTOMATED UI EXPORT CHECK — not a human listening judgment.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export judgments', exact: true }).click();
  await (await download).saveAs(`${directory}/browser-export-check.json`);
  await page.reload();
  await page.getByLabel('Excerpt', { exact: true }).selectOption('7');
  if (await page.getByLabel('Overall judgment', { exact: true }).inputValue() !== 'failed') throw new Error('Review did not persist across refresh');
  if (errors.length) throw new Error(errors.join('\n'));
  const result = { errors, observations, switchTimeDifference: after-before,
    limitation: 'Artifact and UI validation only. The candidate has a known ownership regression; no musical acceptance, accuracy or production integration is claimed.' };
  await writeFile(`${directory}/browser-check.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ excerpts: observations.length, modes: 9, errors, switchTimeDifference: after-before }));
} finally { await browser.close(); }
