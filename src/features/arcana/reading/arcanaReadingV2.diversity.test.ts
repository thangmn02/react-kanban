import { describe, it, expect } from 'vitest';

import { arcanaCards, getArcanaCardById } from '../arcanaCards';
import { getArcanaQuestionById } from '../arcanaQuestions';
import { buildArcanaReading, serializeArcanaReading, validateReadingSpecificity } from '../arcanaReadingEngine';
import { arcanaSpreadOrder, resolveArcanaDraw } from '../arcanaSystems';
import type { ArcanaOrientation, ArcanaSpreadCard, ArcanaSpreadPosition } from '../types';
import { buildArcanaReadingV2Detailed } from './arcanaReadingComposerV2';

function makeSpread(cards: Array<[string, ArcanaOrientation]>, locale: 'en' | 'vi' = 'en'): ArcanaSpreadCard[] {
  const positions: ArcanaSpreadPosition[] = ['past', 'present', 'future'];
  return cards.map(([cardId, orientation], index) => {
    const data = getArcanaCardById(cardId);
    if (!data) throw new Error(`unknown card ${cardId}`);
    return {
      position: positions[index],
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

describe('canonical spreads', () => {
  it('resolves the two documented example spreads to distinct, spec-clean readings', () => {
    const qLove = getArcanaQuestionById('love-notice')!;
    const qFinance = getArcanaQuestionById('finance-energy')!;

    for (const locale of ['en', 'vi'] as const) {
      const spreadA = makeSpread([
        ['king-of-swords', 'upright'],
        ['four-of-pentacles', 'reversed'],
        ['ace-of-cups', 'reversed'],
      ], locale);
      const spreadB = makeSpread([
        ['five-of-pentacles', 'upright'],
        ['king-of-cups', 'reversed'],
        ['eight-of-pentacles', 'reversed'],
      ], locale);
      const a = buildArcanaReadingV2Detailed(spreadA, qLove, 'love', locale, 'demo-a', null);
      console.log(`\n===== Example A (${locale}) strategy=${a.plan.strategy} signals=${a.plan.evidence.map((s) => s.kind).join(',')} rel=${a.plan.relationshipClaim.kind} refl=${a.plan.reflectionPrompt.kind} arc=${a.analysis.toneArc.direction} hinge=${a.analysis.hingeRole} =====`);
      console.log(serializeArcanaReading(a.content, locale));
      console.log('specificity warnings:', validateReadingSpecificity(a.content, spreadA, qLove, locale));

      const b = buildArcanaReadingV2Detailed(spreadB, qFinance, 'finance', locale, 'demo-b', null);
      console.log(`\n===== Example B (${locale}) strategy=${b.plan.strategy} signals=${b.plan.evidence.map((s) => s.kind).join(',')} rel=${b.plan.relationshipClaim.kind} refl=${b.plan.reflectionPrompt.kind} arc=${b.analysis.toneArc.direction} hinge=${b.analysis.hingeRole} =====`);
      console.log(serializeArcanaReading(b.content, locale));
      console.log('specificity warnings:', validateReadingSpecificity(b.content, spreadB, qFinance, locale));

      // The two canonical spreads must analyse to genuinely different
      // arguments, cite at least two spread signals each, and pass the
      // specificity linter in both locales — proof the reading is
      // spread-driven, not card-name insertion. (Both happen to share the
      // top-level `inner-block` strategy, so the divergence is asserted on the
      // relationship, reflection and rendered text instead.)
      expect(a.plan.evidence.length).toBeGreaterThanOrEqual(2);
      expect(b.plan.evidence.length).toBeGreaterThanOrEqual(2);
      expect(a.plan.relationshipClaim.kind).not.toBe(b.plan.relationshipClaim.kind);
      expect(a.plan.reflectionPrompt.kind).not.toBe(b.plan.reflectionPrompt.kind);
      expect(a.content.connection).not.toBe(b.content.connection);
      expect(a.content.gentleMessage).not.toBe(b.content.gentleMessage);
      expect(validateReadingSpecificity(a.content, spreadA, qLove, locale)).toEqual([]);
      expect(validateReadingSpecificity(b.content, spreadB, qFinance, locale)).toEqual([]);
    }

    const spreadAv1 = makeSpread([
      ['king-of-swords', 'upright'],
      ['four-of-pentacles', 'reversed'],
      ['ace-of-cups', 'reversed'],
    ]);
    const v1a = buildArcanaReading(spreadAv1, qLove, 'love', 'en', 'demo-a', null);
    console.log('\n===== Example A V1 (en) =====');
    console.log(serializeArcanaReading(v1a, 'en'));
  });
});

// --- diversity calibration -------------------------------------------------

function makeDrawnSpread(seed: string): ArcanaSpreadCard[] {
  return resolveArcanaDraw('arcana', seed).rolls.map((roll, index) => {
    const card = getArcanaCardById(roll.cardId);
    return {
      position: arcanaSpreadOrder[index] ?? 'present',
      cardId: roll.cardId,
      slug: card?.slug ?? roll.cardId,
      cardName: card?.name.en ?? roll.cardId,
      imagePath: '',
      arcana: card?.arcana.en ?? '',
      atlas: card?.atlas ?? 'major',
      atlasIndex: card?.atlasIndex ?? 0,
      rarity: roll.rarity,
      finish: roll.finish,
      orientation: roll.orientation,
    };
  });
}

const allCardNames = arcanaCards.map((card) => card.name.en).sort((a, b) => b.length - a.length);

function fingerprint(text: string): string {
  let out = ` ${text} `;
  for (const name of allCardNames) {
    out = out.split(name).join(' ');
  }
  return out.toLowerCase().replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordSet(text: string): Set<string> {
  return new Set(fingerprint(text).split(' ').filter((w) => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection += 1;
  return intersection / (a.size + b.size - intersection || 1);
}

describe('diversity calibration', () => {
  it('reports metrics', () => {
    const q = getArcanaQuestionById('work-energy')!;
    const size = 48;
    const results = Array.from({ length: size }, (_, i) =>
      buildArcanaReadingV2Detailed(makeDrawnSpread(`cal-${i}`), q, 'work', 'en', `cal-${i}`, null));

    const strategies = new Map<string, number>();
    for (const r of results) {
      strategies.set(r.plan.strategy, (strategies.get(r.plan.strategy) ?? 0) + 1);
    }

    const uniq = (texts: string[]) => new Set(texts.map(fingerprint)).size;
    const overviewUniq = uniq(results.map((r) => r.content.overview));
    const connectionUniq = uniq(results.map((r) => r.content.connection));
    const gentleUniq = uniq(results.map((r) => r.content.gentleMessage));
    const fullUniq = uniq(results.map((r) => `${r.content.overview} ${r.content.connection} ${r.content.gentleMessage}`));

    const sets = results.map((r) => wordSet(`${r.content.overview} ${r.content.connection} ${r.content.gentleMessage}`));
    let maxSum = 0;
    let over80 = 0;
    for (let i = 0; i < sets.length; i += 1) {
      let max = 0;
      for (let j = 0; j < sets.length; j += 1) {
        if (i === j) continue;
        max = Math.max(max, jaccard(sets[i], sets[j]));
      }
      maxSum += max;
      if (max > 0.8) over80 += 1;
    }

    const avgMaxJaccard = maxSum / sets.length;
    console.log('strategies:', Object.fromEntries(strategies));
    console.log(`unique overview frames: ${overviewUniq}/${size}`);
    console.log(`unique connection frames: ${connectionUniq}/${size}`);
    console.log(`unique gentle frames: ${gentleUniq}/${size}`);
    console.log(`unique full frames: ${fullUniq}/${size}`);
    console.log(`avg max-jaccard: ${avgMaxJaccard.toFixed(3)}, readings with max>0.8: ${over80}`);

    // Non-flaky guard (deterministic seeds cal-0..cal-47). Thresholds sit with
    // clear margin below the observed run so ordinary editorial tweaks pass,
    // but a collapse back toward a small template set fails. Observed at
    // authoring time: strategies=7, overview=45, connection=39, gentle=22,
    // full=48, avgMaxJaccard=0.647, over80=11.
    //
    // The card-name fingerprint strips all 78 card names first, so this
    // measures *sentence-frame* diversity, not mere card-name substitution.
    expect(strategies.size).toBeGreaterThanOrEqual(5);
    expect(fullUniq).toBe(size); // every full reading must be structurally unique
    expect(overviewUniq).toBeGreaterThanOrEqual(38);
    expect(connectionUniq).toBeGreaterThanOrEqual(32);
    expect(gentleUniq).toBeGreaterThanOrEqual(16);
    expect(avgMaxJaccard).toBeLessThan(0.75);
    expect(over80).toBeLessThanOrEqual(18);
  });
});
