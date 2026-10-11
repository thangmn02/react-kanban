import { withInstrumentBrowser } from './instrument-test-browser.mjs';

// Exercise different FFT-window alignments with the actual separator, including
// leading-tail cases that previously counted one piano attack twice.
await withInstrumentBrowser(async page => {
  for (const phase of [58, 186, 314, 442, 570, 698, 826, 954]) {
    const attacks = await page.evaluate(async phase => {
      const { createInstrumentWorker } = await import('/extensions/kanban-music/instrument-runtime.js');
      let complete, fail;
      const done = new Promise((ok, reject) => { complete = ok; fail = reject; });
      const events = [];
      const worker = createInstrumentWorker({ notes(batch) {
        events.push(...batch); if (batch.at(-1)?.time >= 2.8) complete();
      }, error(message) { fail(Error(message)); } });
      let timeout;
      try {
        await worker.ready;
        const pcm = new Float32Array(44100 * 4.5);
        [60, 60, 64, 67].forEach((pitch, index) => {
          const at = Math.round((1 + index * .4) * 44100) + phase;
          const frequency = 440 * 2 ** ((pitch - 69) / 12);
          for (let sample = 0; sample < 44100 * .3; sample++) {
            const t = sample / 44100, envelope = Math.min(1, t / .005) * Math.exp(-t * 9);
            let value = 0;
            for (let harmonic = 1; harmonic <= 8; harmonic++) value += Math.sin(2 * Math.PI * frequency * harmonic * t)
              * Math.exp(-t * harmonic * 2) / harmonic ** 1.5;
            pcm[at + sample] = value * envelope * .25;
          }
        });
        for (let frame = 0; frame < pcm.length; frame += 2048) {
          const left = new Float32Array(2048); left.set(pcm.subarray(frame, frame + 2048));
          worker.send({ kind: 'pcm', left, right: left.slice(), startFrame: frame });
          await new Promise(done => setTimeout(done, 15));
        }
        await Promise.race([done, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Output timeout')), 20000); })]);
        let previous = 0;
        return events.filter(event => { if (event.state.note <= previous) return false; previous = event.state.note; return true; });
      } finally { clearTimeout(timeout); worker.stop(); }
    }, phase);
    console.log(JSON.stringify({ phase, attacks: attacks.length, times: attacks.map(event => event.time) }));
    if (attacks.length !== 4) throw Error(`Piano alignment ${phase} produced ${attacks.length} attacks`);
  }
});
