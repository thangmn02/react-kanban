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
