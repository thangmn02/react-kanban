// Immutable conversion of Deezer's MIT-licensed Spleeter 4-stem weights.
// Code/conversion attribution is in INSTRUMENT-NOTICES.md. Model data only;
// inference code and WASM ship inside the extension, never from a remote CDN.
export const modelRevision = '87c5b6d2874aeb8377b3dca27c9223aa252a6cdb';
export const modelCache = 'kora-instrument-spleeter-v1';
export const instrumentSampleRate = 44100;
export const instrumentDelay = 3.5;
export const modelFrames = 128;
export const modelBins = 1024;
export const models = [
  { name: 'vocals', bytes: 39361004, sha256: '341bd47da8a0ea590178e9d342cbd6ac168cf05f0bf8ce6a62d1ef18f8358701' },
  { name: 'drums', bytes: 39361003, sha256: 'fe832ff1b9ea54b7d3fd8256fa464e21dbccb3cafa83d4f72d3ee2d5dc21f997' },
  { name: 'bass', bytes: 39361002, sha256: 'be84af108ec6a5b538d35fd5643799393c4c0bbfa21f2ea1308ca1364a076d81' },
  { name: 'other', bytes: 39361003, sha256: '9fa7fc4ecbe8d75f0b3c9fea65a0c8b7a32518a7c0ed55339036ad342fb8bedd' },
].map((model) => ({ ...model, url: `https://huggingface.co/Best-Practice/spleeter-4stems-onnx/resolve/${modelRevision}/${model.name}.onnx` }));

export async function loadModel(model, { cache, fetcher = fetch, digest = crypto.subtle.digest.bind(crypto.subtle), progress = () => {} } = {}) {
  const verify = async (bytes) => bytes.byteLength === model.bytes
    && [...new Uint8Array(await digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('') === model.sha256;
  const saved = await cache?.match(model.url);
  if (saved) {
    const bytes = await saved.arrayBuffer();
    if (await verify(bytes)) { progress(model.bytes); return new Uint8Array(bytes); }
    await cache.delete(model.url);
  }
  const response = await fetcher(model.url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error('Model download unavailable');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(model.bytes);
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.length > bytes.length) throw new Error('Unexpected model size');
      bytes.set(value, size); size += value.length; progress(size);
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!await verify(bytes)) throw new Error('Model integrity check failed');
  await cache?.put(model.url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
  return bytes;
}
