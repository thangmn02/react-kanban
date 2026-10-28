import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { handleNoteImages, prepareNoteImage } from './note-images';

describe('private note image boundary', () => {
  it('decodes, scales and strips image metadata before storage', async () => {
    const source = await sharp({ create: { width: 3000, height: 1000, channels: 4, background: '#abcdef88' } }).png().withMetadata({ orientation: 3 }).toBuffer();
    const output = await prepareNoteImage(source), metadata = await sharp(output.data).metadata();
    expect(output.width).toBe(2048); expect(output.height).toBe(683); expect(output.mimeType).toBe('image/png'); expect(output.sha256).toMatch(/^[a-f0-9]{64}$/); expect(metadata.exif).toBeUndefined();
  });
  it('rejects executable and corrupt input instead of trusting MIME', async () => {
    await expect(prepareNoteImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'))).rejects.toThrow('still PNG');
    await expect(prepareNoteImage(Buffer.from([137,80,78,71]))).rejects.toThrow();
  });
  it('fails closed without credentials or for foreign origins', async () => {
    expect((await handleNoteImages(new Request('https://kora.test/api/note-images', { method: 'POST' }), {})).status).toBe(503);
    expect((await handleNoteImages(new Request('https://kora.test/api/note-images', { method: 'POST', headers: { origin: 'https://foreign.test' } }), {})).status).toBe(403);
  });
});
