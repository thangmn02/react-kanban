export interface MediaAsset { provider: 'youtube' | 'spotify' | 'soundcloud' | 'deezer' | 'tidal' | 'apple'; id: string }
export function parseMediaAsset(value: unknown): MediaAsset | undefined;
export function mediaAssetFromUrl(value: string): MediaAsset | undefined;
