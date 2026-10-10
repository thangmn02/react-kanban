// Isolated local playback checks; no user profile or production data changes.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const directory = 'src-tauri/target/melody-closure';
const cases = JSON.parse(await readFile(`${directory}/report.json`, 'utf8')).cases;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [], observations = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  for (let i = 0; i < cases.length; i++) {
    await page.getByLabel('Excerpt', { exact: true }).selectOption(String(i));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 2);
    const duration = await page.locator('audio').evaluate(audio => audio.duration);
    if (Math.abs(duration - cases[i].duration) > .05) throw new Error('Audio/analysis duration mismatch');
    if (!cases[i].notes.every((note, j, notes) => note.start >= 0 && note.end > note.start && note.end <= duration + .001
      && (!j || note.start >= notes[j - 1].end))) throw new Error('Selected voice overlaps or leaves excerpt');
    observations.push({ label: cases[i].label, duration, attacks: cases[i].notes.length });
  }
  await page.getByLabel('Excerpt', { exact: true }).selectOption('3');
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 2);
  await page.locator('audio').evaluate(audio => { audio.currentTime = 6; return audio.play(); });
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 6.2);
  const before = await page.locator('audio').evaluate(audio => audio.currentTime);
  await page.getByRole('button', { name: 'Original + Melody attack clicks', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').src.endsWith('primary-clicks.wav') && !document.querySelector('audio').paused);
  const after = await page.locator('audio').evaluate(audio => audio.currentTime);
  if (Math.abs(before - after) > .4) throw new Error('Comparison changed playback position');
  await page.locator('audio').evaluate(audio => audio.pause());
  await page.getByRole('button', { name: 'Selected pitches + clicks (synthesized)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').src.endsWith('selected-pitches.wav') && document.querySelector('audio').readyState >= 2);
  if (!await page.locator('audio').evaluate(audio => audio.paused)) throw new Error('Mode switch resumed paused audio');
  await page.getByLabel('Listening judgment').selectOption('wrong');
  await page.getByLabel('Listening comments').fill('Automated export check only; not human listening acceptance.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export listening judgments', exact: true }).click();
  await (await download).saveAs(`${directory}/export-check.json`);
  await writeFile(`${directory}/browser-check.json`, JSON.stringify({ errors, observations, switchTimeDifference: after - before,
    limitation: 'Playback UI and artifact bounds only; no perceptual listening or production integration claim.' }, null, 2));
  console.log(JSON.stringify({ errors, excerpts: observations.length, switchTimeDifference: after - before }));
  if (errors.length) throw new Error('Comparison page error');
} finally { await browser.close(); }
