import { arcanaMajorCards } from './arcanaMajorCards';
import { arcanaMinorCards } from './arcanaMinorCards';
import type { ArcanaCard, ArcanaLocale, ArcanaOrientation } from './types';

// Full 78-card catalog: 22 Major Arcana (DX-Tarots atlas) + 56 Minor Arcana
// (JellyMod atlas). Card ids already match the HF corpus slugs (e.g. "the-sun",
// "three-of-cups"), so we attach slug = id here.
export const arcanaCards: ArcanaCard[] = [...arcanaMajorCards, ...arcanaMinorCards].map((card) => ({
  ...card,
  slug: card.slug ?? card.id,
}));

const cardsById = new Map(arcanaCards.map((card) => [card.id, card]));
const cardsBySlug = new Map(arcanaCards.map((card) => [card.slug, card]));

export function getArcanaCardById(cardId: string): ArcanaCard | undefined {
  return cardsById.get(cardId);
}

export function getArcanaCardBySlug(slug: string): ArcanaCard | undefined {
  return cardsBySlug.get(slug);
}

/** Localized display fields for a card, honoring orientation for the meaning. */
export function getArcanaCardDisplay(
  card: ArcanaCard,
  locale: ArcanaLocale,
  orientation: ArcanaOrientation = 'upright',
) {
  const reversed = orientation === 'reversed';
  return {
    name: card.name[locale],
    arcana: card.arcana[locale],
    keywords: reversed ? card.reversedKeywords[locale] : card.keywords[locale],
    meaning: reversed ? card.reversedMeaning[locale] : card.meaning[locale],
  };
}
