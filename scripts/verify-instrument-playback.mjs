import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { modelDir, withInstrumentBrowser } from './instrument-test-browser.mjs';

await withInstrumentBrowser(async page => {
  const results = await page.evaluate(async () => {
    const { createCaptureEngine } = await import('/extensions/kanban-music/capture-engine.js');
    const { prepareInstrumentCapture } = await import('/extensions/kanban-music/instrument-runtime.js');
    const context = new AudioContext({ sampleRate: 44100 });
    const actualOutput = context.destination, monitor = context.createAnalyser();
    monitor.fftSize = 256; monitor.connect(actualOutput);
    Object.defineProperty(context, 'destination', { value: monitor });
    const stream = context.createMediaStreamDestination();
    const buffer = context.createBuffer(2, 44100 * 9, 44100);
    const expected = [1, 1.4, 1.8, 2.2], pitches = [60, 60, 64, 67];
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      expected.forEach((at, index) => {
        const frequency = 440 * 2 ** ((pitches[index] - 69) / 12);
        for (let sample = 0; sample < 44100 * .3; sample++) {
          const t = sample / 44100, env = Math.min(1, t / .005) * Math.exp(-t * 9);
          let value = 0;
          for (let harmonic = 1; harmonic <= 8; harmonic++) value += Math.sin(2 * Math.PI * frequency * harmonic * t) * Math.exp(-t * harmonic * 2) / harmonic ** 1.5;
          data[Math.round(at * 44100) + sample] = value * env * .25;
        }
      });
    }
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(stream);
    const notes = [], audible = [], errors = [];
    let start, previousEnergy = 0;
    const engine = createCaptureEngine({ getUserMedia: async () => stream.stream, createAudioContext: () => context,
      createInstrumentCapture: options => prepareInstrumentCapture({ ...options, onError: message => { errors.push(message); options.onError(); } }),
      onBeat() {}, onStop() {}, onMelody(_id, state) {
        if (state.note > (notes.at(-1)?.note || 0)) notes.push({ time: context.currentTime - start, note: state.note });
      } });
    const renew = setInterval(() => engine.renew('timing'), 2000);
    const samples = new Float32Array(256);
    const meter = setInterval(() => {
      monitor.getFloatTimeDomainData(samples);
      const energy = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
      if (energy > .001 && previousEnergy < .0003 && context.currentTime - start - (audible.at(-1) || -10) > .15) audible.push(context.currentTime - start);
      previousEnergy = energy;
    }, 5);
    try {
      if (!await engine.start('local-stream', 'timing')) throw Error('Capture failed');
      start = context.currentTime + .1; source.start(start);
      await new Promise(done => setTimeout(done, 8500));
      return { expectedAudible: expected.map(time => time + 3.5), audible, notes, errors, baseLatency: context.baseLatency, outputLatency: context.outputLatency };
    } finally { clearInterval(renew); clearInterval(meter); source.stop(); engine.stop(); }
  });

  if (results.errors.length || results.notes.length !== 4 || results.audible.length !== 4) throw Error(JSON.stringify(results));
  const worst = Math.max(...results.notes.map((note, index) => Math.abs(note.time - results.audible[index])));
  if (worst > .09) throw Error('Instrument notes missed their audible timing');
  console.log(JSON.stringify({ ...results, worstAudioNoteErrorMs: worst * 1000 }, null, 2));
  await writeFile(resolve(modelDir, 'playback-results.json'), JSON.stringify(results, null, 2));
});
