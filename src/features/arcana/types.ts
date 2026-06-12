import type { ArcanaAtlasName } from './arcanaAtlas';

// Topic groups shown in the picker.
export type ArcanaTopic = 'work' | 'love' | 'study' | 'finance' | 'self' | 'life';

// Pack types (presentational; mapped onto DX-Tarots booster art).
export type ArcanaPackType = 'standard' | 'arcana' | 'celestial' | 'spectral' | 'jumbo' | 'mega';

// Card rarity tiers.
export type ArcanaRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Card finish / foil types. Each must behave visually distinct.
export type ArcanaFinish = 'plain' | 'silver' | 'holo' | 'prism' | 'galaxy' | 'eclipse' | 'spectral';

// Card orientation, separate from rarity/finish.
export type ArcanaOrientation = 'upright' | 'reversed';

// Position in a three-card spread (past / present / future).
export type ArcanaSpreadPosition = 'past' | 'present' | 'future';

export type ArcanaLocale = 'en' | 'vi';

/** Bilingual string pair. */
export interface ArcanaText {
  en: string;
  vi: string;
}

/** Bilingual string-list pair. */
export interface ArcanaTextList {
  en: string[];
  vi: string[];
}

export interface ArcanaCardData {
  id: string;
  atlas: ArcanaAtlasName;
  atlasIndex: number;
  group: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  /**
   * Stable lowercase slug matching the HF corpus (e.g. "the-sun").
   * Defaults to `id` when omitted; attached by the catalog.
   */
  slug?: string;
  name: ArcanaText;
  arcana: ArcanaText;
  keywords: ArcanaTextList;
  meaning: ArcanaText;
  reversedKeywords: ArcanaTextList;
  reversedMeaning: ArcanaText;
  accent: string;
}

/** Card data guaranteed to have a slug (post-catalog). */
export type ArcanaCard = ArcanaCardData & { slug: string };

export interface ArcanaQuestion {
  id: string;
  topic: ArcanaTopic;
  text: ArcanaText;
}

/** One card within a three-card spread, with its own cosmetic roll. */
export interface ArcanaSpreadCard {
  position: ArcanaSpreadPosition;
  cardId: string;
  slug: string;
  cardName: string;
  arcana: string;
  atlas: ArcanaAtlasName;
  atlasIndex: number;
  rarity: ArcanaRarity;
  finish: ArcanaFinish;
  orientation: ArcanaOrientation;
}

export interface ArcanaReading {
  id: string;
  questionId: string;
  /** Localized question text captured at draw time. */
  questionText: string;
  topic: ArcanaTopic;
  packType: ArcanaPackType;
  /** Three-card spread. */
  cards: ArcanaSpreadCard[];
  /** Order-independent slug key for the spread (matches HF corpus combo keys). */
  comboKey: string;
  /** Full localized reading text shown to the user. */
  messageSnapshot: string;
  /** Raw English corpus reading the interpretation drew from, if matched. */
  corpusReading?: string;
  /** Locale the snapshot text was generated in. */
  locale: ArcanaLocale;
  createdAt: string;
}

/** Deterministic per-card cosmetic roll, before display fields are attached. */
export interface ArcanaCardRoll {
  cardId: string;
  rarity: ArcanaRarity;
  finish: ArcanaFinish;
  orientation: ArcanaOrientation;
}

/** Deterministic outcome of opening a pack: a full three-card spread. */
export interface ArcanaDrawResult {
  rolls: ArcanaCardRoll[];
  seed: string;
}
