import { webcrypto } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { loadModel } from './instrument-models.js';
import { resizeModelWindow } from './model-window.js';

it('discards a corrupt cached model and caches only hash-verified complete bytes', async () => {
  const data = new Uint8Array([1, 2, 3]);
  const hash = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', data))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const cache = { match: vi.fn(async () => new Response(new Uint8Array([9, 9, 9]))), delete: vi.fn(), put: vi.fn() };
  const fetcher = vi.fn(async () => new Response(data));
  const model = { url: 'https://example.com/model.onnx', bytes: 3, sha256: hash };
  const bytes = await loadModel(model, { cache, fetcher, digest: webcrypto.subtle.digest.bind(webcrypto.subtle) });
  expect([...bytes]).toEqual([...data]);
  expect(cache.delete).toHaveBeenCalledWith(model.url);
  expect(cache.put).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledWith(model.url, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
});

it.each([[1, 2], [1, 2, 3, 4], [9, 9, 9]])('never caches incomplete, oversized or altered model data: %s', async (...values) => {
  const data = new Uint8Array([1, 2, 3]);
  const sha256 = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', data))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const cache = { match: vi.fn(), put: vi.fn() };
  await expect(loadModel({ url: 'https://example.com/model.onnx', bytes: 3, sha256 }, {
    cache, fetcher: async () => new Response(Uint8Array.from(values)), digest: webcrypto.subtle.digest.bind(webcrypto.subtle),
  })).rejects.toThrow();
  expect(cache.put).not.toHaveBeenCalled();
});

it('rejects malformed model protobuf and unsupported window sizes', () => {
  expect(() => resizeModelWindow(new Uint8Array([0xff]))).toThrow();
  expect(() => resizeModelWindow(new Uint8Array(), 96)).toThrow();
  expect(() => resizeModelWindow(new Uint8Array([0x3a, 0x7f]))).toThrow();
});
