import { expect, it } from 'vitest';
import { mediaAssetFromUrl, parseMediaAsset } from './media-asset.js';
it('uses stable content identity and discards query credentials and playlist state', () => {
  expect(mediaAssetFromUrl('https://www.youtube.com/watch?v=abcdefghijk&list=private&token=secret')).toEqual({ provider: 'youtube', id: 'abcdefghijk' });
  expect(mediaAssetFromUrl('https://open.spotify.com/track/1234567890123456789012')).toEqual({ provider: 'spotify', id: '1234567890123456789012' });
  expect(mediaAssetFromUrl('https://soundcloud.com/artist/song?secret=private')).toEqual({ provider: 'soundcloud', id: 'artist/song' });
  expect(mediaAssetFromUrl('https://open.spotify.com/playlist/1234567890123456789012')).toBeUndefined();
  expect(mediaAssetFromUrl('https://soundcloud.com/search/sounds')).toBeUndefined();
  expect(mediaAssetFromUrl('https://untrusted.example/watch?v=abcdefghijk')).toBeUndefined();
  expect(parseMediaAsset({ provider: '__proto__', id: 'x' })).toBeUndefined();
});

it('requires a live exact-URL development grant for content-addressed first-party audio', () => {
  const asset = { provider: 'kora-development', id: 'a'.repeat(64) };
  const sourceUrl = `https://private-test.example/kora-lead-test/${asset.id}.wav`;
  const scope = { asset, sourceUrl, expiresAt: Date.now() + 60000 };
  expect(parseMediaAsset(asset)).toEqual(asset);
  expect(parseMediaAsset({ ...asset, id: 'not-a-content-hash' })).toBeUndefined();
  expect(mediaAssetFromUrl(sourceUrl)).toBeUndefined();
  expect(mediaAssetFromUrl(sourceUrl, scope)).toEqual(asset);
  for (const invalid of [sourceUrl.replace('https:', 'http:'), sourceUrl + '?id=secret',
    sourceUrl.replace('private-test.example', 'another.example'), sourceUrl.replace(asset.id, 'b'.repeat(64))]) {
    expect(mediaAssetFromUrl(invalid, scope)).toBeUndefined();
  }
  expect(mediaAssetFromUrl(sourceUrl, { ...scope, expiresAt: Date.now() - 1 })).toBeUndefined();
});
