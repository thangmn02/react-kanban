import { buildComboKey } from './hfTarotData';
import type { ArcanaReading, ArcanaSpreadCard } from './types';

export const arcanaReadingsStorageKey = 'app.arcana.readings';

const maxReadings = 30;

/**
 * Read saved readings. Tolerant of older snapshots: pre-spread single-card
 * entries are migrated into a one-card "present" spread so history keeps
 * working across upgrades.
 */
export function readArcanaHistory(): ArcanaReading[] {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(arcanaReadingsStorageKey);
    if (!value) return [];
    const parsed = JSON.parse(value) as Array<Partial<ArcanaReading> & LegacyReading>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeReading);
  } catch {
    return [];
  }
}

/** Shape of pre-spread (single-card) saved readings. */
interface LegacyReading {
  cardId?: string;
  cardName?: string;
  arcana?: string;
  atlas?: ArcanaSpreadCard['atlas'];
  atlasIndex?: number;
  rarity?: ArcanaSpreadCard['rarity'];
  finish?: ArcanaSpreadCard['finish'];
  orientation?: ArcanaSpreadCard['orientation'];
}

function migrateLegacySpread(reading: LegacyReading): ArcanaSpreadCard[] {
  return [
    {
      position: 'present',
      cardId: reading.cardId ?? 'the-fool',
      slug: reading.cardId ?? 'the-fool',
      cardName: reading.cardName ?? '',
      imagePath: reading.atlas === 'minor' ? '/arcana/atlas/minor.png' : '/arcana/atlas/tarots.png',
      arcana: reading.arcana ?? 'Major Arcana',
      atlas: reading.atlas ?? 'major',
      atlasIndex: typeof reading.atlasIndex === 'number' ? reading.atlasIndex : 0,
      rarity: reading.rarity ?? 'common',
      finish: reading.finish ?? 'plain',
      orientation: reading.orientation ?? 'upright',
    },
  ];
}

function normalizeReading(reading: Partial<ArcanaReading> & LegacyReading): ArcanaReading {
  const cards = Array.isArray(reading.cards) && reading.cards.length > 0
    ? reading.cards
    : migrateLegacySpread(reading);

  return {
    id: reading.id ?? `arcana-${Math.random().toString(36).slice(2, 10)}`,
    questionId: reading.questionId ?? '',
    questionText: reading.questionText ?? '',
    topic: reading.topic ?? 'life',
    packType: reading.packType ?? 'standard',
    cards,
    comboKey: reading.comboKey ?? buildComboKey(cards.map((card) => card.slug)),
    messageSnapshot: reading.messageSnapshot ?? '',
    corpusReading: reading.corpusReading,
    readingEngineVersion: reading.readingEngineVersion === 2 ? 2 : 1,
    locale: reading.locale ?? 'vi',
    createdAt: reading.createdAt ?? new Date().toISOString(),
  };
}

export function saveArcanaReading(reading: ArcanaReading): ArcanaReading[] {
  if (typeof window === 'undefined') return [];

  const nextHistory = [reading, ...readArcanaHistory().filter((item) => item.id !== reading.id)].slice(0, maxReadings);
  window.localStorage.setItem(arcanaReadingsStorageKey, JSON.stringify(nextHistory));
  return nextHistory;
}
