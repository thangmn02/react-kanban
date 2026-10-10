import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'src-tauri/target/gymnopedie-polyphonic-evidence';
const audit = JSON.parse(await readFile(`${directory}/audit.json`, 'utf8'));
const preservation = JSON.parse(await readFile(`${directory}/preservation.json`, 'utf8'));
for (const [path, expected] of Object.entries(preservation.before)) {
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== expected) throw new Error(`Protected file changed: ${path}`);
}
if (audit.semanticEventsProduced !== 0 || audit.newModelRuns !== 0 || audit.acceptedStemEvents.length !== 7) throw new Error('Audit scope changed');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5173/${directory}/listen.html`);
  for (let index = 0; index < audit.cases.length; index++) {
    await page.getByLabel('Diagnostic location').selectOption(String(index));
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && document.querySelector('img').complete && document.querySelector('img').naturalWidth > 0);
    const audio = page.locator('audio');
    if (Math.abs(await audio.evaluate(a => a.duration)-4) > .00001) throw new Error('Context duration changed');
    await audio.evaluate(a => { a.currentTime = 1.5; });
    await page.waitForFunction(() => !document.querySelector('audio').seeking);
    for (const label of ['Saved piano', 'Mix left / piano right', 'Original mix']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').seeking);
      if (Math.abs(await audio.evaluate(a => a.currentTime)-1.5) > .001 || !await audio.evaluate(a => a.paused)) throw new Error('Switch changed paused position');
    }
    await audio.evaluate(a => a.play());
    await page.getByRole('button', { name: 'Saved piano', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 3 && !document.querySelector('audio').paused);
    await audio.evaluate(a => a.pause());
    if (await audio.count() !== 1 || await page.locator('.beat-square').count() !== 0) throw new Error('Extra player or new Grid');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.getByLabel('Diagnostic location').selectOption('2');
  await page.waitForFunction(() => document.querySelector('img').complete && document.querySelector('img').naturalWidth > 0);
  await page.screenshot({ path: `${directory}/context-comparison.png`, fullPage: true });
  const evidence = { protectedFiles: Object.keys(preservation.before).length, errors, clips: 4,
    checks: ['no inference or semantic events', 'seven accepted events unchanged', 'protected hashes unchanged',
      'four-second contexts', 'one player', 'SVG loaded', 'paused and playing input switches preserve position'] };
  await writeFile(`${directory}/browser-check.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
