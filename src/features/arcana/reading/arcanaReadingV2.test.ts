import { describe, expect, it } from 'vitest';

import { arcanaCards, getArcanaCardById, getArcanaCardDisplay } from '../arcanaCards';
import { getArcanaCardImagePath } from '../arcanaAtlas';
import { getArcanaQuestionById } from '../arcanaQuestions';
import {
  buildArcanaReading,
  serializeArcanaReading,
  validateReadingSpecificity,
} from '../arcanaReadingEngine';
import { arcanaReadingsStorageKey, readArcanaHistory } from '../arcanaStorage';
import { arcanaSpreadOrder, resolveArcanaDraw } from '../arcanaSystems';
import { localizeArcanaReading } from '../hooks/useArcanaRitualFlow';
import type {
  ArcanaLocale,
  ArcanaOrientation,
  ArcanaQuestion,
  ArcanaReading,
  ArcanaSpreadCard,
  ArcanaSpreadPosition,
  ArcanaTopic,
} from '../types';
import {
  buildArcanaReadingV2,
  buildArcanaReadingV2Detailed,
  type ArcanaReadingV2Result,
} from './arcanaReadingComposerV2';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const positionOrder: ArcanaSpreadPosition[] = ['past', 'present', 'future'];

function makeSpread(
  cards: Array<[string, ArcanaOrientation]>,
  locale: ArcanaLocale = 'en',
): ArcanaSpreadCard[] {
  return cards.map(([cardId, orientation], index) => {
    const data = getArcanaCardById(cardId);
    if (!data) throw new Error(`unknown card ${cardId}`);
    return {
      position: positionOrder[index],
      cardId,
      slug: data.slug,
      cardName: data.name[locale],
      imagePath: '',
      arcana: data.arcana[locale],
      atlas: data.atlas,
      atlasIndex: data.atlasIndex,
      rarity: 'common',
      finish: 'plain',
      orientation,
    };
  });
}

/** Build a spread exactly the way the ritual flow does: deterministic draw. */
function makeDrawnSpread(seed: string, locale: ArcanaLocale = 'en'): ArcanaSpreadCard[] {
  return resolveArcanaDraw('arcana', seed).rolls.map((roll, index) => {
    const card = getArcanaCardById(roll.cardId);
    return {
      position: arcanaSpreadOrder[index] ?? 'present',
      cardId: roll.cardId,
      slug: card?.slug ?? roll.cardId,
      cardName: card?.name[locale] ?? roll.cardId,
      imagePath: '',
      arcana: card?.arcana[locale] ?? '',
      atlas: card?.atlas ?? 'major',
      atlasIndex: card?.atlasIndex ?? 0,
      rarity: roll.rarity,
      finish: roll.finish,
      orientation: roll.orientation,
    };
  });
}

function question(id: string): ArcanaQuestion {
  const found = getArcanaQuestionById(id);
  if (!found) throw new Error(`unknown question ${id}`);
  return found;
}

function build(
  spread: ArcanaSpreadCard[],
  q: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale = 'en',
  seed = 'test-seed',
): ArcanaReadingV2Result {
  return buildArcanaReadingV2Detailed(spread, q, topic, locale, seed, null);
}

// Canonical example A — love: boundaries vs blocked feeling.
const spreadA = () => makeSpread([
  ['king-of-swords', 'upright'],
  ['four-of-pentacles', 'reversed'],
  ['ace-of-cups', 'reversed'],
]);

// Canonical example B — finance: scarcity loop.
const spreadB = () => makeSpread([
  ['five-of-pentacles', 'upright'],
  ['king-of-cups', 'reversed'],
  ['eight-of-pentacles', 'reversed'],
]);

// Rising arc: hardship -> support -> brightness.
const spreadRising = () => makeSpread([
  ['five-of-swords', 'upright'],
  ['six-of-cups', 'upright'],
  ['the-sun', 'upright'],
]);

// Falling arc: ease -> scarcity -> more scarcity (no Majors, so the arc
// itself drives the strategy rather than Major dominance).
const spreadFalling = () => makeSpread([
  ['nine-of-cups', 'upright'],
  ['five-of-pentacles', 'upright'],
  ['five-of-cups', 'upright'],
]);

// Two Major Arcana -> turning point.
const spreadMajors = () => makeSpread([
  ['the-tower', 'upright'],
  ['death', 'upright'],
  ['three-of-cups', 'upright'],
]);

// Upright ace within a single-suit spread.
const spreadAceWands = () => makeSpread([
  ['ace-of-wands', 'upright'],
  ['six-of-wands', 'upright'],
  ['nine-of-wands', 'upright'],
]);

// Element support (air feeds fire) with no tension and no repeated suit.
const spreadSupport = () => makeSpread([
  ['six-of-swords', 'upright'],
  ['ace-of-wands', 'upright'],
  ['the-sun', 'upright'],
]);

// Element tension (fire vs water).
const spreadTension = () => makeSpread([
  ['ace-of-wands', 'upright'],
  ['two-of-cups', 'upright'],
  ['the-sun', 'upright'],
]);

// Three court cards.
const spreadCourts = () => makeSpread([
  ['king-of-wands', 'upright'],
  ['queen-of-wands', 'upright'],
  ['page-of-swords', 'upright'],
]);

const loveQuestion = question('love-notice');
const financeQuestion = question('finance-energy');
const workQuestion = question('work-energy');

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('produces identical output for identical inputs', () => {
    const first = build(spreadA(), loveQuestion, 'love', 'en', 'seed-1');
    const second = build(spreadA(), loveQuestion, 'love', 'en', 'seed-1');
    expect(second.content).toEqual(first.content);
    expect(second.plan).toEqual(first.plan);
    expect(serializeArcanaReading(second.content, 'en')).toBe(serializeArcanaReading(first.content, 'en'));
  });

  it('keeps the same plan (meaning) even when the seed changes the phrasing', () => {
    const a = build(spreadA(), loveQuestion, 'love', 'en', 'seed-alpha');
    const b = build(spreadA(), loveQuestion, 'love', 'en', 'seed-beta');
    expect(b.plan).toEqual(a.plan);
    expect(b.analysis.signals).toEqual(a.analysis.signals);
  });

  it('is deterministic in Vietnamese as well', () => {
    const first = build(spreadB(), financeQuestion, 'finance', 'vi', 'seed-9');
    const second = build(spreadB(), financeQuestion, 'finance', 'vi', 'seed-9');
    expect(second.content).toEqual(first.content);
  });
});

// ---------------------------------------------------------------------------
// 2. Spread diversity — different spreads argue differently
// ---------------------------------------------------------------------------

describe('spread diversity', () => {
  it('produces different strategies for meaningfully different spreads', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    const rising = build(spreadRising(), loveQuestion, 'love');
    const majors = build(spreadMajors(), loveQuestion, 'love');
    const strategies = new Set([a.plan.strategy, rising.plan.strategy, majors.plan.strategy]);
    expect(strategies.size).toBe(3);
    expect(a.plan.strategy).toBe('inner-block');
    expect(rising.plan.strategy).toBe('recovery');
    expect(majors.plan.strategy).toBe('major-turning-point');
  });

  it('gives different overview, connection and reflection for different spreads on one question', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    const b = build(spreadRising(), loveQuestion, 'love');
    const c = build(spreadMajors(), loveQuestion, 'love');
    const rows = [a.content, b.content, c.content];

    for (const section of ['overview', 'connection', 'gentleMessage'] as const) {
      const texts = rows.map((row) => row[section]);
      expect(new Set(texts).size).toBe(3);
    }
  });

  it('differs beyond card-name substitution (fingerprint stays distinct)', () => {
    const strip = (text: string) => {
      let out = ` ${text} `;
      for (const card of arcanaCards) out = out.split(card.name.en).join(' ');
      return out.toLowerCase().replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const a = build(spreadA(), loveQuestion, 'love');
    const b = build(spreadRising(), loveQuestion, 'love');
    expect(strip(a.content.overview)).not.toBe(strip(b.content.overview));
    expect(strip(a.content.connection)).not.toBe(strip(b.content.connection));
    expect(strip(a.content.gentleMessage)).not.toBe(strip(b.content.gentleMessage));
  });
});


// ---------------------------------------------------------------------------
// 3. Reversal concentration
// ---------------------------------------------------------------------------

describe('reversal concentration', () => {
  it('detects two or more reversed cards as a spread-level signal', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    expect(a.analysis.reversedCount).toBe(2);
    expect(a.analysis.signals.some((s) => s.kind === 'reversal-concentration')).toBe(true);
    expect(a.plan.evidence.some((s) => s.kind === 'reversal-concentration' || s.kind === 'blocked-beginning')).toBe(true);
  });

  it('reads reversal-heavy spreads as internalized or blocked, not as failure', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    expect(a.plan.strategy).toBe('inner-block');
    expect(a.content.overview.toLowerCase()).toMatch(/held back|under the surface|unblocked/);
  });

  it('canonical example B reads as a loop with a sustainable-step reflection', () => {
    const b = build(spreadB(), financeQuestion, 'finance');
    expect(b.analysis.toneArc.direction).toBe('steady-dark');
    expect(b.plan.reflectionPrompt.kind).toBe('sustainable-step');
    expect(b.content.gentleMessage).toMatch(/routine|habit/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Elemental dominance
// ---------------------------------------------------------------------------

describe('elemental dominance', () => {
  it('recognizes three cards of one suit as elemental dominance', () => {
    const wands = build(spreadAceWands(), workQuestion, 'work');
    expect(wands.analysis.dominantElement).toEqual({ element: 'fire', count: 3 });
    expect(wands.analysis.signals.some((s) => s.kind === 'element-dominance')).toBe(true);
    expect(wands.analysis.signals.some((s) => s.kind === 'suit-repeat')).toBe(true);
    expect(wands.content.connection.toLowerCase()).toMatch(/wands|fire/);
  });

  it('recognizes a repeated suit across two cards', () => {
    const b = build(spreadB(), financeQuestion, 'finance');
    expect(b.analysis.suitCounts.pentacles).toBe(2);
    expect(b.plan.relationshipClaim.kind).toBe('suit-repeat');
    expect(b.content.connection).toContain('Pentacles');
  });
});

// ---------------------------------------------------------------------------
// 5. Elemental relationships — support vs tension pick different plans
// ---------------------------------------------------------------------------

describe('elemental relationships', () => {
  it('selects a support relationship for friendly element pairs', () => {
    const support = build(spreadSupport(), workQuestion, 'work');
    expect(support.plan.relationshipClaim.kind).toBe('element-support');
    expect(support.content.connection.toLowerCase()).toMatch(/cooperate|friendly|leans|supported/);
  });

  it('selects a tension relationship for contrary element pairs', () => {
    const tension = build(spreadTension(), loveQuestion, 'love');
    expect(tension.plan.relationshipClaim.kind).toBe('element-tension');
    expect(tension.plan.strategy).toBe('tension-and-resolution');
    expect(tension.content.connection.toLowerCase()).toMatch(/friction|tension|knot/);
  });

  it('support and tension spreads produce different narrative plans', () => {
    const support = build(spreadSupport(), workQuestion, 'work');
    const tension = build(spreadTension(), workQuestion, 'work');
    expect(support.plan.relationshipClaim.kind).not.toBe(tension.plan.relationshipClaim.kind);
    expect(support.content.connection).not.toBe(tension.content.connection);
  });
});


// ---------------------------------------------------------------------------
// 6. Major Arcana pattern
// ---------------------------------------------------------------------------

describe('major arcana pattern', () => {
  it('activates the turning-point strategy for two or more Majors', () => {
    const majors = build(spreadMajors(), loveQuestion, 'love');
    expect(majors.analysis.majorCount).toBe(2);
    expect(majors.plan.strategy).toBe('major-turning-point');
    expect(majors.plan.evidence.some((s) => s.kind === 'major-dominance')).toBe(true);
    expect(majors.content.overview).toMatch(/Major Arcana/);
  });

  it('does not activate the strategy for a single Major', () => {
    const single = build(makeSpread([
      ['the-sun', 'upright'],
      ['six-of-wands', 'upright'],
      ['nine-of-cups', 'upright'],
    ]), workQuestion, 'work');
    expect(single.analysis.majorCount).toBe(1);
    expect(single.plan.strategy).not.toBe('major-turning-point');
  });
});

// ---------------------------------------------------------------------------
// 7. Ace / new beginning through orientation
// ---------------------------------------------------------------------------

describe('ace energy', () => {
  it('reads an upright ace as a live beginning', () => {
    const wands = build(spreadAceWands(), workQuestion, 'work');
    expect(wands.analysis.signals.some((s) => s.kind === 'ace-present')).toBe(true);
    expect(wands.content.cardReadings[0].text.toLowerCase()).toContain('beginning');
  });

  it('reads a reversed ace as a blocked or delayed beginning', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    expect(a.analysis.signals.some((s) => s.kind === 'blocked-beginning')).toBe(true);
    expect(a.plan.reflectionPrompt.kind).toBe('blocked-beginning');
    expect(a.content.cardReadings[2].text.toLowerCase()).toMatch(/delayed|not yet|internal/);
    expect(a.content.gentleMessage.toLowerCase()).toMatch(/held back|not feel safe/);
  });

  it('canonical example A names the blocked feeling without forcing it open', () => {
    const a = build(spreadA(), loveQuestion, 'love');
    expect(a.content.gentleMessage.toLowerCase()).toContain('feeling');
    expect(a.content.connection.toLowerCase()).toMatch(/air|earth/);
  });
});

// ---------------------------------------------------------------------------
// 8. Court dynamics
// ---------------------------------------------------------------------------

describe('court dynamics', () => {
  it('lets multiple court cards shape the spread-level interpretation', () => {
    const courts = build(spreadCourts(), workQuestion, 'work');
    expect(courts.analysis.courts).toHaveLength(3);
    expect(courts.analysis.signals.some((s) => s.kind === 'court-dynamics')).toBe(true);
    expect(courts.plan.strategy).toBe('court-dynamics');
    expect(courts.plan.evidence.some((s) => s.kind === 'court-dynamics')).toBe(true);
    expect(courts.content.overview.toLowerCase()).toMatch(/court|roles|postures/);
  });

  it('reads a court card section as a posture rather than an event', () => {
    const courts = build(spreadCourts(), workQuestion, 'work');
    expect(courts.content.cardReadings[0].text.toLowerCase()).toMatch(/court|posture/);
  });
});


// ---------------------------------------------------------------------------
// 9. Narrative movement — rising and falling arcs diverge
// ---------------------------------------------------------------------------

describe('narrative movement', () => {
  it('classifies the tone arc of both directions', () => {
    expect(build(spreadRising(), loveQuestion, 'love').analysis.toneArc.direction).toBe('rising');
    expect(build(spreadFalling(), loveQuestion, 'love').analysis.toneArc.direction).toBe('falling');
  });

  it('gives different connection and closing for positive vs negative arcs', () => {
    const rising = build(spreadRising(), loveQuestion, 'love');
    const falling = build(spreadFalling(), loveQuestion, 'love');
    expect(rising.plan.strategy).toBe('recovery');
    expect(falling.plan.strategy).toBe('escalation');
    expect(rising.plan.reflectionPrompt.kind).toBe('trust-the-turn');
    expect(falling.plan.reflectionPrompt.kind).toBe('sustainable-step');
    expect(rising.content.connection).not.toBe(falling.content.connection);
    expect(rising.content.gentleMessage).not.toBe(falling.content.gentleMessage);
    // The arc direction is voiced in the overview's arc sentence.
    expect(rising.content.overview.toLowerCase()).toMatch(/upward/);
    expect(falling.content.overview.toLowerCase()).toMatch(/care/);
  });
});

// ---------------------------------------------------------------------------
// 10. Bilingual parity — one plan, two languages
// ---------------------------------------------------------------------------

describe('bilingual parity', () => {
  it('builds the identical plan for English and Vietnamese', () => {
    const en = build(spreadA(), loveQuestion, 'love', 'en');
    const vi = build(spreadA(), loveQuestion, 'love', 'vi');
    const strip = (plan: typeof en.plan) => {
      const { reflectionPrompt, ...rest } = plan;
      // hingeShadow is a localized string, so it legitimately differs between
      // locales — exclude it from the language-neutral parity comparison.
      const reflection = { ...reflectionPrompt };
      delete reflection.hingeShadow;
      return { ...rest, reflectionPrompt: reflection };
    };
    expect(strip(vi.plan)).toEqual(strip(en.plan));
    expect(vi.analysis.signals.map((s) => s.kind)).toEqual(en.analysis.signals.map((s) => s.kind));
  });

  it('expresses the same interpretation in both languages', () => {
    const en = build(spreadA(), loveQuestion, 'love', 'en');
    const vi = build(spreadA(), loveQuestion, 'love', 'vi');
    expect(en.content.overview).not.toBe(vi.content.overview);
    // Same semantic skeleton: strategy, relationship and reflection kind.
    expect(vi.plan.strategy).toBe(en.plan.strategy);
    expect(vi.plan.relationshipClaim.kind).toBe(en.plan.relationshipClaim.kind);
    expect(vi.plan.reflectionPrompt.kind).toBe(en.plan.reflectionPrompt.kind);
    // Both locales name the same three cards in the overview.
    for (const part of en.content.cardReadings) {
      expect(en.content.overview).toContain(part.cardName);
    }
    expect(vi.content.cardReadings[0].cardName).toBe('Quốc Vương Kiếm');
    expect(vi.content.gentleMessage).toContain('cảm xúc');
  });

  it('passes the specificity validator in both locales', () => {
    for (const locale of ['en', 'vi'] as const) {
      const spread = makeSpread([
        ['king-of-swords', 'upright'],
        ['four-of-pentacles', 'reversed'],
        ['ace-of-cups', 'reversed'],
      ], locale);
      const result = build(spread, loveQuestion, 'love', locale);
      expect(validateReadingSpecificity(result.content, spread, loveQuestion, locale)).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Backward compatibility — V1 records keep their engine + snapshot
// ---------------------------------------------------------------------------

/** Replicates the card-mapping the ritual flow applies before composing. */
function hookStyleCards(reading: ArcanaReading, locale: ArcanaLocale): ArcanaSpreadCard[] {
  return reading.cards.map((spreadCard) => {
    const card = getArcanaCardById(spreadCard.cardId);
    const display = card ? getArcanaCardDisplay(card, locale, spreadCard.orientation) : null;
    return {
      ...spreadCard,
      slug: card?.slug ?? spreadCard.slug,
      cardName: display?.name ?? spreadCard.cardName,
      imagePath: getArcanaCardImagePath(card?.atlas ?? spreadCard.atlas),
      arcana: display?.arcana ?? spreadCard.arcana,
      atlas: card?.atlas ?? spreadCard.atlas,
      atlasIndex: card?.atlasIndex ?? spreadCard.atlasIndex,
    };
  });
}

function makeStoredReading(version: 1 | 2 | undefined): ArcanaReading {
  return {
    id: 'arcana-legacy-seed',
    questionId: 'love-notice',
    questionText: loveQuestion.text.en,
    topic: 'love',
    packType: 'arcana',
    cards: spreadA(),
    comboKey: 'ace-of-cups|four-of-pentacles|king-of-swords',
    messageSnapshot: 'Stored snapshot text',
    readingEngineVersion: version,
    locale: 'en',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('backward compatibility', () => {
  it('re-localizes legacy (version-less) readings with the V1 engine', () => {
    const legacy = makeStoredReading(undefined);
    const localized = localizeArcanaReading(legacy, 'en');
    const expected = serializeArcanaReading(
      buildArcanaReading(hookStyleCards(legacy, 'en'), loveQuestion, 'love', 'en', legacy.id, null),
      'en',
    );
    expect(localized.messageSnapshot).toBe(expected);
    expect(localized.readingEngineVersion).toBeUndefined();
  });

  it('re-localizes V2 readings with the V2 engine', () => {
    const v2 = makeStoredReading(2);
    const localized = localizeArcanaReading(v2, 'en');
    const expected = serializeArcanaReading(
      buildArcanaReadingV2(hookStyleCards(v2, 'en'), loveQuestion, 'love', 'en', v2.id, null),
      'en',
    );
    expect(localized.messageSnapshot).toBe(expected);
    expect(localized.readingEngineVersion).toBe(2);
    // V1 and V2 must not silently produce the same text for this spread.
    const v1Text = serializeArcanaReading(
      buildArcanaReading(hookStyleCards(v2, 'en'), loveQuestion, 'love', 'en', v2.id, null),
      'en',
    );
    expect(localized.messageSnapshot).not.toBe(v1Text);
  });

  it('migrates stored history without losing the snapshot or stamping V2', () => {
    const raw = makeStoredReading(undefined);
    window.localStorage.setItem(arcanaReadingsStorageKey, JSON.stringify([raw]));
    const history = readArcanaHistory();
    expect(history).toHaveLength(1);
    expect(history[0].messageSnapshot).toBe('Stored snapshot text');
    expect(history[0].readingEngineVersion).toBe(1);
    expect(history[0].cards).toHaveLength(3);
    window.localStorage.removeItem(arcanaReadingsStorageKey);
  });
});


// ---------------------------------------------------------------------------
// 12. Corpus failure / optionality
// ---------------------------------------------------------------------------

describe('corpus optionality', () => {
  it('produces a complete reading with no corpus at all', () => {
    const spread = spreadA();
    const content = buildArcanaReadingV2(spread, loveQuestion, 'love', 'en', 'seed-3', null);
    expect(content.source).toBe('template');
    expect(content.overview.length).toBeGreaterThan(0);
    expect(content.connection.length).toBeGreaterThan(0);
    expect(content.gentleMessage.length).toBeGreaterThan(0);
    expect(content.cardReadings.every((part) => part.text.length > 0)).toBe(true);
    expect(validateReadingSpecificity(content, spread, loveQuestion, 'en')).toEqual([]);
  });

  it('uses corpus motifs only as a soft signal and never pastes raw corpus text', () => {
    const corpusText = 'A reading about choice and balance from the local archive corpus that must never appear verbatim.';
    const content = buildArcanaReadingV2(spreadA(), loveQuestion, 'love', 'en', 'seed-3', {
      reading: corpusText,
      overlap: 3,
    });
    expect(content.source).toBe('hf_exact');
    expect(content.connection).toContain('local reading archive');
    expect(content.connection).not.toContain(corpusText);
  });

  it('keeps plan and meaning identical with and without a corpus match', () => {
    const without = build(spreadA(), loveQuestion, 'love', 'en', 'seed-4');
    const withCorpus = buildArcanaReadingV2Detailed(spreadA(), loveQuestion, 'love', 'en', 'seed-4', {
      reading: 'love and connection',
      overlap: 2,
    });
    expect(withCorpus.plan).toEqual(without.plan);
    expect(withCorpus.content.source).toBe('hf_partial');
  });
});

// ---------------------------------------------------------------------------
// 13. No contradictions
// ---------------------------------------------------------------------------

describe('no contradictions', () => {
  it('never describes a reversed card as upright (or vice versa)', () => {
    const en = build(spreadA(), loveQuestion, 'love', 'en');
    expect(en.content.cardReadings[0].orientation).toBe('upright');
    expect(en.content.cardReadings[0].text.toLowerCase()).not.toContain('reversed');
    for (const part of en.content.cardReadings.slice(1)) {
      expect(part.orientation).toBe('reversed');
      expect(part.text.toLowerCase()).toContain('reversed');
    }

    const vi = build(spreadA(), loveQuestion, 'love', 'vi');
    expect(vi.content.cardReadings[0].text).not.toContain('ngược');
    expect(vi.content.cardReadings[1].text).toContain('ngược');
    expect(vi.content.cardReadings[2].text).toContain('ngược');
  });

  it('never promises a happy resolution for unresolved (dark) arcs', () => {
    const forbidden = /will be fine|works out|everything is going to be okay|bright side|it all works|happy ending/i;
    for (const spreadFactory of [spreadB, spreadFalling]) {
      const result = build(spreadFactory(), financeQuestion, 'finance', 'en');
      expect(result.content.gentleMessage).not.toMatch(forbidden);
      expect(result.content.connection).not.toMatch(forbidden);
      expect(result.content.overview).not.toMatch(forbidden);
    }
  });

  it('never describes a reversed relief card as blocked', () => {
    // Reversed Moon is a relief (fog lifting): it must not be read as a block.
    const relief = build(makeSpread([
      ['the-moon', 'reversed'],
      ['six-of-cups', 'upright'],
      ['the-sun', 'upright'],
    ]), loveQuestion, 'love');
    expect(relief.content.cardReadings[0].text.toLowerCase()).toMatch(/lifting|easing/);
  });
});


// ---------------------------------------------------------------------------
// 14. Diversity sampling — proves the output is not a small template set
//
// Method: draw 48 deterministic spreads (resolveArcanaDraw with fixed seeds),
// compose readings for ONE question, then strip all card names from the text
// ("fingerprint"). If the engine were a small template set with card names
// swapped in, the fingerprints would collapse to a handful of frames.
//
// Calibrated on 2026-07-20 against this implementation (deterministic, so
// these thresholds cannot flake; they only move if the engine changes):
//   strategies seen: 7 | overview 45/48 | connection 39/48 | gentle 23/48
//   full 48/48 | avg max-jaccard 0.644
// Thresholds below carry generous margins while still failing a template-set
// regression (a 3-template engine would yield <=3 unique frames per section).
// ---------------------------------------------------------------------------

const allCardNames = arcanaCards.map((card) => card.name.en).sort((a, b) => b.length - a.length);

function fingerprint(text: string): string {
  let out = ` ${text} `;
  for (const name of allCardNames) {
    out = out.split(name).join(' ');
  }
  return out.toLowerCase().replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordSet(text: string): Set<string> {
  return new Set(fingerprint(text).split(' ').filter((word) => word.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  return intersection / (a.size + b.size - intersection || 1);
}

describe('diversity sampling', () => {
  const sampleSize = 48;
  const samples = Array.from({ length: sampleSize }, (_, i) =>
    build(makeDrawnSpread(`diversity-${i}`), workQuestion, 'work', 'en', `diversity-${i}`));

  it('covers at least four distinct narrative strategies', () => {
    const strategies = new Set(samples.map((sample) => sample.plan.strategy));
    expect(strategies.size).toBeGreaterThanOrEqual(4);
  });

  it('produces mostly unique overview and connection frames (card names stripped)', () => {
    const uniqueRatio = (texts: string[]) => new Set(texts.map(fingerprint)).size / texts.length;
    expect(uniqueRatio(samples.map((s) => s.content.overview))).toBeGreaterThanOrEqual(0.7);
    expect(uniqueRatio(samples.map((s) => s.content.connection))).toBeGreaterThanOrEqual(0.65);
    expect(uniqueRatio(samples.map((s) => s.content.gentleMessage))).toBeGreaterThanOrEqual(0.4);
    expect(uniqueRatio(samples.map((s) => `${s.content.overview} ${s.content.connection} ${s.content.gentleMessage}`)))
      .toBeGreaterThanOrEqual(0.95);
  });

  it('keeps pairwise similarity low on average', () => {
    const sets = samples.map((s) => wordSet(`${s.content.overview} ${s.content.connection} ${s.content.gentleMessage}`));
    let maxSum = 0;
    for (let i = 0; i < sets.length; i += 1) {
      let max = 0;
      for (let j = 0; j < sets.length; j += 1) {
        if (i !== j) max = Math.max(max, jaccard(sets[i], sets[j]));
      }
      maxSum += max;
    }
    expect(maxSum / sets.length).toBeLessThanOrEqual(0.72);
  });

  it('every sampled connection cites a detected spread signal', () => {
    for (const sample of samples) {
      expect(sample.plan.relationshipClaim.kind).not.toBe('triad');
      expect(sample.plan.evidence.length).toBeGreaterThanOrEqual(1);
    }
  });
});
