import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'src-tauri/target/gymnopedie-upstream-f0';
const report = JSON.parse(await readFile(`${directory}/report.json`, 'utf8'));
const preservation = JSON.parse(await readFile(`${directory}/preservation.json`, 'utf8'));
for (const [path, expected] of Object.entries(preservation.before)) {
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== expected) throw new Error(`Baseline changed: ${path}`);
}
for (const input of ['mix', 'stem']) {
  const data = JSON.parse(await readFile(`${directory}/${input}-diagnostic.json`, 'utf8'));
  const changed = Object.keys(data.diagnosticParameters).filter(k => data.diagnosticParameters[k] !== data.baselineParameters[k]);
  if (changed.length !== 1 || changed[0] !== 'guessUnvoiced' || !data.stages.baselineReproducedExactly || data.semantic !== false) throw new Error('Invalid diagnostic comparison');
}
if (report.semanticEventsProduced !== 0 || report.inputs.stem.some(r => r.baselineVoicedFrames !== 0 || r.guessedNegativeConfidenceFrames !== r.frames)) throw new Error('Incorrect unvoiced provenance');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  for (let index = 0; index < report.audio.length; index++) {
    await page.getByLabel('Diagnostic location').selectOption(String(index));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3);
    const audio = page.locator('audio');
    if (Math.abs(await audio.evaluate(a => a.duration)-.8) > .00001) throw new Error('Clip duration/alignment changed');
    await audio.evaluate(a => { a.currentTime = .2; });
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    for (const label of ['Saved piano', 'Mix left / piano right', 'Original mix']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').seeking);
      if (Math.abs(await audio.evaluate(a => a.currentTime)-.2) > .001 || !await audio.evaluate(a => a.paused)) throw new Error('Switch changed paused position');
    }
    await audio.evaluate(a => a.play());
    await page.getByRole('button', { name: 'Saved piano', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').paused);
    await audio.evaluate(a => a.pause());
    if (await audio.count() !== 1 || await page.locator('.beat-square').count() !== 0) throw new Error('Extra clock or speculative Grid');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: `${directory}/audio-comparison.png`, fullPage: true });
  const evidence = { protectedFiles: Object.keys(preservation.before).length, errors, clips: 4,
    checks: ['one-option diagnostic', 'exposed components reproduce baseline exactly', 'negative-confidence provenance',
      'no semantic events', 'baseline hash preservation', '0.8s aligned clips', 'one player', 'paused and playing channel switch'] };
  await writeFile(`${directory}/browser-check.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
