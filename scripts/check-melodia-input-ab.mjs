// Private original-clock A/B checks; no perceptual accuracy claims.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'src-tauri/target/generalized-melody', evidence = 'src-tauri/target/melodia-input-ab';
const report = JSON.parse(await readFile(`${directory}/melodia-input-ab-report.json`, 'utf8'));
const frozen = JSON.parse(await readFile(`${evidence}/preserved-before.json`, 'utf8'));
for (const [path, expected] of Object.entries(frozen)) {
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== expected) throw new Error(`Protected baseline changed: ${path}`);
}
for (const caseData of report.cases.filter(c => c.inputAb)) {
  const pair = caseData.inputAb;
  if (pair.mix.analyzerSha256 !== pair.stem.analyzerSha256 || JSON.stringify(pair.mix.parameters) !== JSON.stringify(pair.stem.parameters)
    || JSON.stringify(pair.mix.segmentationParameters) !== JSON.stringify(pair.stem.segmentationParameters)
    || pair.alignment.correlationLagSamples !== 0) throw new Error('Inputs are not equivalent/aligned');
  for (const name of ['mix', 'stem']) {
    const inputHash = createHash('sha256').update(await readFile(`${directory}/${caseData.id}/input-ab/${name}-input.wav`)).digest('hex');
    if (inputHash !== pair[name].analysisAudioSha256) throw new Error('Wrong analyzed input');
    const raw = JSON.parse(await readFile(`${directory}/${caseData.id}/input-ab/${name}/analysis.json`, 'utf8'));
    if (raw.notes.some((n, i) => Math.abs(pair[name].notes[i].start - n.start - pair.start) > 1e-10
      || pair[name].notes[i].pitch !== n.pitch)) throw new Error('Notes were retimed or tuned');
  }
}
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  await page.getByLabel('Melody stream', { exact: true }).waitFor();
  for (let index = 0; index < report.cases.length; index++) {
    const item = report.cases[index]; if (!item.inputAb) continue;
    const pair = item.inputAb, audio = page.locator('audio');
    await page.getByLabel('Excerpt', { exact: true }).selectOption(String(index));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    await page.waitForFunction(() => Boolean(document.querySelector('#melody-stream option[value="melodia-stem-ab"]')));
    for (const [name, label] of [['mix', 'A: Mix F0'], ['stem', 'B: Stem F0']]) {
      await audio.evaluate(a => a.pause());
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(name => document.querySelector('audio').readyState >= 3 && document.querySelector('audio').src.endsWith(`/input-ab/${name}-f0.wav`), name);
      if (await audio.count() !== 1 || await page.locator('.beat-square').count() !== 40 || await page.locator('canvas').count() !== 1) throw new Error('Duplicate clock/grid/chart');
      if (await page.getByLabel('Melody stream', { exact: true }).inputValue() !== `melodia-${name}-ab`) throw new Error('Wrong A/B stream');
      const note = pair[name].notes.find(n => n.start > pair.start+.15);
      await audio.evaluate((a, time) => { a.currentTime = time; }, note.start-.15);
      await page.waitForFunction(() => !document.querySelector('audio').seeking);
      await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
      await page.waitForFunction(target => {
        const flash = document.querySelector('[data-channel="melody"] [data-beat-trace]');
        return flash && Math.abs(Number(flash.dataset.targetPlaybackTime)-target) < .00001;
      }, note.start, { timeout: 4000 });
      await page.waitForTimeout(70);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export row trace', exact: true }).click();
      const path = `${evidence}/${item.id}-${name}-browser-trace.json`;
      await (await download).saveAs(path);
      const trace = JSON.parse(await readFile(path, 'utf8'));
      if (!trace.rows.melody.length || trace.flashes.some(e => e.row !== 5 || !e.semantic)) throw new Error('A/B cross-row flash');
      if (trace.rows.melody.some(e => e.audioSha256 !== item.audioSha256 || e.analysisAudioSha256 !== pair[name].analysisAudioSha256
        || e.version !== pair[name].version || e.targetPlaybackTime < pair.start || e.targetPlaybackTime >= pair.end)) throw new Error('Wrong source/offset identity');
      const offsets = trace.flashes.filter(e => e.stage === 'animation').map(e => (e.actualPlaybackTime-e.targetPlaybackTime)*1000);
      if (!offsets.length || offsets.some(ms => ms < -80 || ms > 250)) throw new Error('A/B target/animation clock mismatch');
      checks.push({ id: item.id, input: name, target: note.start, animationOffsetMs: offsets, commits: trace.rows.melody.length });
      await audio.evaluate(a => a.pause());
      await page.waitForFunction(() => !document.querySelector('[data-beat-trace]'));
    }
    await audio.evaluate((a, position) => { a.currentTime = position; }, pair.start+4);
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    for (const [label, suffix] of [['Original left / A F0 right', 'mix-original-f0.wav'], ['Original left / B F0 right', 'stem-original-f0.wav'], ['Selected stem audio', 'stem-audio.wav'], ['Passage original', 'original.wav']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(suffix => document.querySelector('audio').readyState >= 3 && document.querySelector('audio').src.endsWith(suffix), suffix);
      if (Math.abs(await audio.evaluate(a => a.currentTime)-(pair.start+4)) > .01 || !await audio.evaluate(a => a.paused)) throw new Error('A/B switch changed original position');
    }
    // Switch inputs during playback and seek in both directions without stale flashes.
    await page.getByRole('button', { name: 'A: Mix F0', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    await audio.evaluate(a => a.play());
    await page.getByRole('button', { name: 'B: Stem F0', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').paused);
    for (const position of [pair.start+7, pair.start+1]) {
      await audio.evaluate((a, time) => { a.currentTime = time; }, position);
      await page.waitForFunction(() => !document.querySelector('audio').seeking);
      await page.waitForTimeout(80);
      const flash = await page.locator('[data-channel="melody"] [data-beat-trace]').getAttribute('data-target-playback-time').catch(() => null);
      if (flash !== null && Number(flash) < position) throw new Error('Stale pre-seek target');
    }
    await audio.evaluate(a => a.pause());
    await page.waitForFunction(() => !document.querySelector('[data-beat-trace]'));
    // The bounded passage ends automatically; selecting an A/B audition replays its start.
    await audio.evaluate((a, position) => { a.currentTime = position; }, pair.end-.2);
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    await audio.evaluate(a => a.play());
    await page.waitForFunction(() => document.querySelector('audio').paused, { timeout: 2000 });
    if ((await audio.evaluate(a => a.currentTime)) > pair.end+.3) throw new Error('Passage ran beyond its bound');
    await page.getByRole('button', { name: 'B: Stem F0', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    if (Math.abs(await audio.evaluate(a => a.currentTime)-pair.start) > .01) throw new Error('Passage replay did not return to original start');
  }
  await page.screenshot({ path: `${evidence}/input-ab-browser.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${evidence}/browser-check.json`, JSON.stringify({ errors, checks, preservedFiles: Object.keys(frozen).length,
    clock: 'original 30-second fixture currentTime', musicalAcceptance: 'pending-human-listening',
    checksPassed: ['identical analyzer parameters', 'aligned input samples', 'preserved baseline hashes', 'four actual input streams', 'one grid/chart/player',
      'original-position A/B switch', 'playing A/B switch', 'pause flush', 'record/export crop/source identities', 'forward/backward seek', 'seek/replay', 'bounded passage end'] }, null, 2));
  console.log(JSON.stringify({ checks, errors, preservedFiles: Object.keys(frozen).length }));
} finally { await browser.close(); }
