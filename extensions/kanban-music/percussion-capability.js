// Optional local inference assets are deliberately excluded from public releases.
export async function hasLearnedPercussion(api, fetchAsset = fetch) {
  try {
    if (!api.runtime.getManifest().content_security_policy?.extension_pages?.includes("'wasm-unsafe-eval'")) return false;
    const response = await fetchAsset(api.runtime.getURL('generated/percussion/percussion.json'));
    if (!response.ok) return false;
    const config = await response.json();
    if (config.version !== 1 || config.bins !== 84 || config.sampleRate !== 44100 || config.classifier === 'causal') return false;
    const assets = ['generated/percussion/percussion.onnx', 'vendor/percussion/ort.wasm.min.mjs',
      'vendor/percussion/ort-wasm-simd-threaded.mjs', 'vendor/percussion/ort-wasm-simd-threaded.wasm'];
    return (await Promise.all(assets.map(path => fetchAsset(api.runtime.getURL(path), { method: 'HEAD' })))).every(result => result.ok);
  } catch { return false; }
}
