// Real fixture audio + existing React renderer checks; no musical judgment is inferred.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const directory = 'src-tauri/target/generalized-melody';
const cases = JSON.parse(await readFile(`${directory}/report.json`, 'utf8')).cases;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  await page.getByLabel('Melody stream', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.beat-square').length === 40);
  if (await page.locator('audio').count() !== 1) throw new Error('More than one media clock');
  await page.getByLabel('Excerpt', { exact: true }).selectOption('7');
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
  await page.getByLabel('Melody stream', { exact: true }).selectOption('v3');
  await page.locator('audio').evaluate(a => { a.pause(); a.currentTime = 16; });
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  await page.locator('audio').evaluate(a => a.play());
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Five-row event counters"]').textContent.includes('Melody: 2'), { timeout: 7000 });
  await page.getByRole('button', { name: 'Missed note', exact: true }).click();
  await page.getByRole('button', { name: 'Incorrect pitch', exact: true }).click();
  const exportFile = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export row trace', exact: true }).click();
  await (await exportFile).saveAs(`${directory}/melody-grid-browser-trace.json`);
  const trace = JSON.parse(await readFile(`${directory}/melody-grid-browser-trace.json`, 'utf8'));
  if (!trace.rows.melody.length || trace.rows.melody.some(e => e.row !== 5 || e.selectedSource !== 'vocals' || !Number.isFinite(e.midiPitch) || !Number.isFinite(e.actualPlaybackTime))) throw new Error('Missing Row 5/source/pitch/clock trace');
  if (trace.flashes.some(e => !e.semantic || e.row !== 5)) throw new Error('Nonsemantic or cross-row flash');
  if (trace.markers.length !== 2) throw new Error('Markers did not export');
  const timing = trace.flashes.filter(e => e.stage === 'animation').map(e => (e.actualPlaybackTime-e.targetPlaybackTime)*1000);
  if (!timing.length || timing.some(ms => ms < -80 || ms > 250)) throw new Error('Fixture animation timing outside diagnostic tolerance');
  await page.locator('audio').evaluate(a => a.pause());
  await page.waitForFunction(() => !document.querySelector('[data-beat-trace]'));
  const pausedPosition = await page.locator('audio').evaluate(a => a.currentTime);
  await page.waitForTimeout(400);
  if (Math.abs(await page.locator('audio').evaluate(a => a.currentTime)-pausedPosition) > .005) throw new Error('Paused media advanced');
  await page.getByLabel('Melody stream', { exact: true }).selectOption('candidate');
  await page.waitForTimeout(200);
  if (await page.locator('[data-beat-trace]').count()) throw new Error('Paused A/B produced a flash');
  // A backward seek/replay must produce a new run without duplicating any queued event.
  await page.locator('audio').evaluate(a => { a.currentTime = 0; });
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  await page.locator('audio').evaluate(a => a.play());
  await page.waitForTimeout(50);
  await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
  await page.waitForTimeout(1300);
  const replayFile = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export row trace', exact: true }).click();
  await (await replayFile).saveAs(`${directory}/melody-grid-replay-trace.json`);
  const replay = JSON.parse(await readFile(`${directory}/melody-grid-replay-trace.json`, 'utf8'));
  if (!replay.rows.melody.length || replay.rows.melody.some(e => e.version !== cases[7].version)) throw new Error('A/B retained stale v3 events');
  if (new Set(replay.rows.melody.map(e => e.eventId)).size !== replay.rows.melody.length) throw new Error('Replay duplicate');
  // Forward seek omits old pending targets; then comparison/raw auditions reuse this player.
  await page.locator('audio').evaluate(a => { a.currentTime = 24; });
  await page.waitForFunction(() => !document.querySelector('audio').seeking);
  await page.waitForTimeout(350);
  const current = await page.locator('[data-beat-trace]').getAttribute('data-target-playback-time').catch(() => null);
  if (current !== null && Number(current) < 24) throw new Error('Stale pre-seek flash');
  const before = await page.locator('audio').evaluate(a => a.currentTime);
  await page.getByRole('button', { name: 'Preserved v3 + clicks', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').paused && document.querySelector('audio').src.includes('baseline-audio'));
  const switchDifference = await page.locator('audio').evaluate(a => a.currentTime)-before;
  if (Math.abs(switchDifference) > .5 || await page.getByLabel('Melody stream', { exact: true }).inputValue() !== 'v3') throw new Error('Audio/grid A/B mismatch');
  await page.locator('audio').evaluate(a => a.pause());
  await page.getByRole('button', { name: 'Raw source pitches (polyphonic)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && document.querySelector('audio').src.includes('raw-vocals'));
  if (await page.locator('audio').count() !== 1 || !await page.locator('audio').evaluate(a => a.paused)) throw new Error('Raw audition changed clock count/pause');
  await page.getByRole('button', { name: 'Record 30 seconds', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('audio').paused);
  if (!(await page.getByText('Recording up to 30 media seconds;', { exact: false }).count())) throw new Error('Paused record did not arm on the new playback generation');
  await page.locator('audio').evaluate(a => a.pause());
  const firstEventChecks = [];
  for (let index = 0; index < cases.length; index++) {
    const entry = cases[index], stream = entry.baseline.notes.length ? 'v3' : 'candidate';
    const notes = stream === 'v3' ? entry.baseline.notes : entry.notes;
    if (!notes.length) continue;
    await page.getByLabel('Excerpt', { exact: true }).selectOption(String(index));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    await page.getByLabel('Melody stream', { exact: true }).selectOption(stream);
    await page.locator('audio').evaluate((a, position) => { a.currentTime = position; }, Math.max(0, notes[0].start-.12));
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    await page.locator('audio').evaluate(a => a.play());
    await page.waitForFunction(target => {
      const element = document.querySelector('[data-channel="melody"] [data-beat-trace]');
      return element && Math.abs(Number(element.dataset.targetPlaybackTime)-target) < .00001;
    }, notes[0].start, { timeout: 2000 });
    firstEventChecks.push({ id: entry.id, stream, firstTarget: notes[0].start });
    await page.locator('audio').evaluate(a => a.pause());
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${directory}/melody-grid-browser-check.json`, JSON.stringify({ errors, cells: 40, audioElements: 1,
    committedMelodyEvents: trace.rows.melody.length, animationOffsetMs: timing, switchDifference, firstEventChecks,
    checks: ['pause/resume', 'backward seek/replay', 'forward seek', 'v3/candidate flush', 'row5-only', 'source/pitch/clock export', 'human markers', 'raw auditions'],
    musicalQuality: 'FAILED for prior extraction; this UI check makes no listening judgment' }, null, 2));
  console.log(JSON.stringify({ cells: 40, committed: trace.rows.melody.length, animationOffsetMs: timing, errors }));
} finally { await browser.close(); }
