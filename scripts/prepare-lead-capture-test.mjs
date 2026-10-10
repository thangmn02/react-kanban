import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Original procedural music, with no recording, model or third-party samples.
// The generated audio is CC0. This file prepares hosting artifacts only.
const directory = resolve('src-tauri/target/lead-cache-replay/https-source');
const rate = 44100, seconds = 60, frames = rate * seconds;
const samples = new Float64Array(frames);
function note(midi, start, duration, gain, harmonics) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  for (let i = Math.ceil(start * rate); i < Math.min(frames, (start + duration) * rate); i++) {
    const t = i / rate - start;
    const envelope = Math.min(1, t / .025, (duration - t) / .09);
    let tone = 0;
    for (let h = 0; h < harmonics.length; h++) tone += harmonics[h] * Math.sin(2 * Math.PI * frequency * (h + 1) * t);
    samples[i] += gain * Math.max(0, envelope) * tone;
  }
}
const melody = [72, 74, 76, 79, 77, 76, 74, 72, 76, 77, 79, 81, 79, 76, 74, 72];
for (let phrase = 0; phrase < 5; phrase++) {
  const start = .5 + phrase * 12;
  for (let index = 0; index < melody.length; index++) note(melody[index], start + index * .6, index === 15 ? 1.15 : .43, .25, [1, .25, .12]);
  for (let index = 0; index < 5; index++) note([48, 53, 55, 48, 55][index], start + index * 2.4, 1.7, .05, [1, .15]);
}
const wav = Buffer.alloc(44 + frames * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < frames; i++) {
  const value = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767);
  wav.writeInt16LE(value, 44 + i * 4); wav.writeInt16LE(value, 46 + i * 4);
}
samples.fill(0);
const hash = createHash('sha256').update(wav).digest('hex');
await mkdir(resolve(directory, 'kora-lead-test'), { recursive: true });
await writeFile(resolve(directory, `kora-lead-test/${hash}.wav`), wav);
await writeFile(resolve(directory, 'test-asset.json'), JSON.stringify({
  asset: { provider: 'kora-development', id: hash }, duration: seconds,
  sampleRate: rate, channels: 2, license: 'CC0-1.0',
  audioPath: `/kora-lead-test/${hash}.wav`, analysisVersion: 'server-lead-pulse-range-v1',
}, null, 2));
await writeFile(resolve(directory, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Kora authorized Lead capture test</title>
<body><main><h1>Kora authorized Lead capture test</h1>
<p>Original, procedurally generated music. Private development capture and analysis only.</p>
<p>Play the audio, then invoke the scoped Kora Companion on this tab. The normal Kora Focus Dock uses this player's clock.</p>
<audio controls preload="metadata" src="./kora-lead-test/${hash}.wav"></audio>
<p>60 seconds · stereo 44.1 kHz · CC0 · first-party content hash</p>
<script>navigator.mediaSession.metadata=new MediaMetadata({title:'Kora original Lead capture test',artist:'Kora development'});</script>
</main></body></html>`);
await writeFile(resolve(directory, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n');
console.log(JSON.stringify({ prepared: true, deployed: false, directory, asset: `kora-development:${hash}`, seconds, bytes: wav.length }));
