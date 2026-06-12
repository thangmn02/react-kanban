import { arcanaCards } from './arcanaCards';
import { createRng, pickWeighted } from './arcanaRng';
import type {
  ArcanaCardRoll,
  ArcanaDrawResult,
  ArcanaFinish,
  ArcanaLocale,
  ArcanaOrientation,
  ArcanaPackType,
  ArcanaRarity,
  ArcanaSpreadPosition,
} from './types';

// ---------------------------------------------------------------------------
// Pack system
// ---------------------------------------------------------------------------

export const arcanaPackOrder: ArcanaPackType[] = [
  'standard',
  'arcana',
  'celestial',
  'spectral',
  'jumbo',
  'mega',
];

export const arcanaPackLabels: Record<ArcanaLocale, Record<ArcanaPackType, string>> = {
  en: {
    standard: 'Standard Pack',
    arcana: 'Arcana Pack',
    celestial: 'Celestial Pack',
    spectral: 'Spectral Pack',
    jumbo: 'Jumbo Pack',
    mega: 'Mega Pack',
  },
  vi: {
    standard: 'Gói Cơ Bản',
    arcana: 'Gói Ẩn Ngữ',
    celestial: 'Gói Thiên Thể',
    spectral: 'Gói Linh Phổ',
    jumbo: 'Gói Cỡ Lớn',
    mega: 'Gói Cực Đại',
  },
};

// Frame index inside the DX-Tarots booster atlas (4 cols x 9 rows).
export const arcanaPackAtlasIndex: Record<ArcanaPackType, number> = {
  standard: 0,
  arcana: 4,
  celestial: 8,
  spectral: 12,
  jumbo: 16,
  mega: 20,
};

// ---------------------------------------------------------------------------
// Rarity system
// ---------------------------------------------------------------------------

export const arcanaRarityOrder: ArcanaRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

export const arcanaRarityLabels: Record<ArcanaLocale, Record<ArcanaRarity, string>> = {
  en: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic',
  },
  vi: {
    common: 'Phổ thông',
    uncommon: 'Ít gặp',
    rare: 'Hiếm',
    epic: 'Sử thi',
    legendary: 'Huyền thoại',
    mythic: 'Huyền bí',
  },
};

const rarityWeightsByPack: Record<ArcanaPackType, Record<ArcanaRarity, number>> = {
  standard: { common: 62, uncommon: 24, rare: 9, epic: 3.5, legendary: 1.2, mythic: 0.3 },
  arcana: { common: 50, uncommon: 28, rare: 13, epic: 6, legendary: 2.4, mythic: 0.6 },
  celestial: { common: 44, uncommon: 29, rare: 16, epic: 7.5, legendary: 2.6, mythic: 0.9 },
  spectral: { common: 38, uncommon: 30, rare: 18, epic: 9, legendary: 3.6, mythic: 1.4 },
  jumbo: { common: 30, uncommon: 30, rare: 22, epic: 11, legendary: 5, mythic: 2 },
  mega: { common: 20, uncommon: 27, rare: 25, epic: 16, legendary: 8, mythic: 4 },
};

// ---------------------------------------------------------------------------
// Finish / foil system
// ---------------------------------------------------------------------------

export const arcanaFinishOrder: ArcanaFinish[] = [
  'plain',
  'silver',
  'holo',
  'prism',
  'galaxy',
  'eclipse',
  'spectral',
];

export const arcanaFinishLabels: Record<ArcanaLocale, Record<ArcanaFinish, string>> = {
  en: {
    plain: 'Matte',
    silver: 'Silver Sheen',
    holo: 'Holo',
    prism: 'Prism',
    galaxy: 'Galaxy',
    eclipse: 'Eclipse',
    spectral: 'Spectral',
  },
  vi: {
    plain: 'Trơn',
    silver: 'Ánh bạc',
    holo: 'Hắt cầu vồng',
    prism: 'Lăng kính',
    galaxy: 'Dải ngân hà',
    eclipse: 'Nhật thực',
    spectral: 'Bóng ma',
  },
};

const finishWeightsByRarity: Record<ArcanaRarity, Record<ArcanaFinish, number>> = {
  common: { plain: 88, silver: 12, holo: 0, prism: 0, galaxy: 0, eclipse: 0, spectral: 0 },
  uncommon: { plain: 64, silver: 28, holo: 8, prism: 0, galaxy: 0, eclipse: 0, spectral: 0 },
  rare: { plain: 30, silver: 34, holo: 26, prism: 10, galaxy: 0, eclipse: 0, spectral: 0 },
  epic: { plain: 8, silver: 22, holo: 30, prism: 24, galaxy: 12, eclipse: 4, spectral: 0 },
  legendary: { plain: 0, silver: 8, holo: 22, prism: 26, galaxy: 24, eclipse: 14, spectral: 6 },
  mythic: { plain: 0, silver: 0, holo: 10, prism: 18, galaxy: 26, eclipse: 26, spectral: 20 },
};

// ---------------------------------------------------------------------------
// Orientation labels
// ---------------------------------------------------------------------------

export const arcanaOrientationLabels: Record<ArcanaLocale, Record<ArcanaOrientation, string>> = {
  en: { upright: 'Upright', reversed: 'Reversed' },
  vi: { upright: 'Thuận', reversed: 'Nghịch' },
};

// ---------------------------------------------------------------------------
// Spread position labels (past / present / future)
// ---------------------------------------------------------------------------

export const arcanaSpreadOrder: ArcanaSpreadPosition[] = ['past', 'present', 'future'];

export const arcanaSpreadLabels: Record<ArcanaLocale, Record<ArcanaSpreadPosition, string>> = {
  en: { past: 'Foundation', present: 'What to see clearly', future: 'What is opening' },
  vi: { past: 'Nền năng lượng', present: 'Điều cần thấy rõ', future: 'Điều đang mở ra' },
};

// ---------------------------------------------------------------------------
// Deterministic draw — three-card spread
// ---------------------------------------------------------------------------

const reversedChance = 0.32;
const spreadSize = 3;

/**
 * Resolve a three-card spread deterministically from a seed. Same pack + seed
 * always yields the same three distinct cards (each with its own rarity /
 * finish / orientation), keeping history reproducible.
 */
export function resolveArcanaDraw(packType: ArcanaPackType, seed: string): ArcanaDrawResult {
  const rng = createRng(`${packType}:${seed}`);
  const deck = [...arcanaCards];
  const rolls: ArcanaCardRoll[] = [];

  for (let i = 0; i < spreadSize && deck.length > 0; i += 1) {
    // Draw a distinct card (Fisher–Yates style pick without replacement).
    const pickIndex = Math.floor(rng() * deck.length);
    const [card] = deck.splice(pickIndex, 1);

    const rarity = pickWeighted(rng(), rarityWeightsByPack[packType]);
    const finish = pickWeighted(rng(), finishWeightsByRarity[rarity]);
    const orientation: ArcanaOrientation = rng() < reversedChance ? 'reversed' : 'upright';

    rolls.push({ cardId: card.id, rarity, finish, orientation });
  }

  return { rolls, seed };
}
