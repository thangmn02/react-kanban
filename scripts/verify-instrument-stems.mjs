import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { modelDir, withInstrumentBrowser } from './instrument-test-browser.mjs';

await withInstrumentBrowser(async page => {
  const fixtures = JSON.parse(await readFile(resolve(modelDir, 'fixtures.json'), 'utf8'));
  const results = [];
  for (const fixture of fixtures.slice(0, 3)) for (const stem of ['other', 'vocals', 'drums', 'bass', 'mixture']) {
    const result = await page.evaluate(async ({ index, stem }) => {
      const { createInstrumentWorker } = await import('/extensions/kanban-music/instrument-runtime.js');
      const pcm = new Float32Array(await (await fetch(`/fixtures/fixture-${index}-${stem}.f32`)).arrayBuffer());
      const total = Math.ceil((pcm.length / 2 + 44100) / 2048) * 2048;
      const chunks = Math.floor((total - 95 * 1024 - 2048) / (64 * 1024)) + 1;
      const lastTime = ((chunks - 1) * 64 + 58) * 1024 / 44100;
      const events = [];
      let completed, reject;
      const done = new Promise((ok, fail) => { completed = ok; reject = fail; });
      const worker = createInstrumentWorker({ notes(batch) {
        events.push(...batch);
        if (batch.at(-1)?.time >= lastTime) completed();
      }, error(message) { reject(Error(message)); } });
      const start = performance.now();
      try {
        await worker.ready;
        const loaded = performance.now();
        for (let frame = 0; frame < total; frame += 2048) {
          const left = new Float32Array(2048), right = new Float32Array(2048);
          for (let i = 0; i < 2048; i++) { left[i] = pcm[(frame + i) * 2] || 0; right[i] = pcm[(frame + i) * 2 + 1] || 0; }
          worker.send({ kind: 'pcm', left, right, startFrame: frame });
          await new Promise(ok => setTimeout(ok, 15));
        }
        await Promise.race([done, new Promise((_, fail) => setTimeout(() => fail(Error('No complete model output')), 20000))]);
        let last = 0;
        const attacks = events.filter(event => { if (event.state.note <= last) return false; last = event.state.note; return true; });
        return { stem, audioSeconds: pcm.length / 2 / 44100, loadMs: loaded - start, processingMs: performance.now() - loaded, attacks: attacks.map(event => ({ time: event.time, level: event.state.level })), states: events.length, lastTime: events.at(-1)?.time };
      } finally { worker.stop(); }
    }, { index: fixture.index, stem });
    if (['vocals', 'drums', 'bass'].includes(stem) && result.attacks.length) throw Error(`Excluded stem produced note attacks: ${JSON.stringify({ fixture: fixture.name, ...result })}`);
    if (['other', 'mixture'].includes(stem) && !result.attacks.length) throw Error('Instrumental excerpt produced no notes');
    results.push({ fixture: fixture.name, ...result });
    console.log(JSON.stringify({ fixture: fixture.name, stem, attacks: result.attacks.length, ms: result.processingMs }));
  }
  await writeFile(resolve(modelDir, 'worker-results.json'), JSON.stringify(results, null, 2));
});
