export interface MediaAsset { provider: 'youtube' | 'spotify' | 'soundcloud' | 'deezer' | 'tidal' | 'apple' | 'kora-development'; id: string }
export function parseMediaAsset(value: unknown): MediaAsset | undefined;
export function mediaAssetFromUrl(value: string, developmentScope?: {asset?: MediaAsset; sourceUrl?: string; expiresAt?: number}): MediaAsset | undefined;
export function stableAsset(memory: Map<string, {src: string; title: string; asset: MediaAsset}>, key: string, media: {src: string; title: string}, asset: MediaAsset | undefined): MediaAsset | undefined;
