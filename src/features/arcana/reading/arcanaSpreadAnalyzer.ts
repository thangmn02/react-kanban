import type {
  ArcanaCourtRole,
  ArcanaElement,
  ArcanaMinorSuit,
  ArcanaMotion,
  ArcanaSemanticCard,
  ArcanaTone,
} from './arcanaCardSemantics';
import { getArcanaElementRelation, type ArcanaElementRelation } from './arcanaElementRelations';

// ---------------------------------------------------------------------------
// Arcana V2 — spread analyzer
//
// Pure, deterministic, locale-free: it looks at the three semantic card
// profiles and reports structured facts + weighted signals. It never decides
// how anything is phrased; the narrative planner consumes this analysis and
// the phrasebooks only see the plan built on top of it.
// ---------------------------------------------------------------------------

export interface ArcanaElementPair {
  /** Indexes into the spread (0 = foundation, 1 = hinge, 2 = opening). */
  a: number;
  b: number;
  elements: [ArcanaElement, ArcanaElement];
  relation: ArcanaElementRelation;
  /** Positional adjacency: hinge-outer pairs weigh slightly more. */
  adjacent: boolean;
}

export type ArcanaToneArcDirection =
  | 'rising' // dark foundation -> lighter opening
  | 'falling' // bright foundation -> heavier opening
  | 'steady-dark' // low at both ends
  | 'steady-bright' // high at both ends
  | 'mixed'; // roughly level, no strong valence

export interface ArcanaToneArc {
  from: ArcanaTone;
  hinge: ArcanaTone;
  to: ArcanaTone;
  direction: ArcanaToneArcDirection;
}

export type ArcanaHingeRole =
  | 'block' // center strain interrupts a brighter outer arc
  | 'redirect' // reversed center turns the current sideways
  | 'bridge' // center element supports both outer cards
  | 'amplifier' // center resonates with at least one neighbor
  | 'neutral';

export type ArcanaSpreadSignalKind =
  | 'major-dominance'
  | 'reversal-concentration'
  | 'element-dominance'
  | 'element-missing'
  | 'element-support'
  | 'element-tension'
  | 'suit-repeat'
  | 'ace-present'
  | 'blocked-beginning'
  | 'court-dynamics'
  | 'number-echo'
  | 'number-sequence'
  | 'tone-arc'
  | 'hinge-role'
  | 'motion-arc';

/** A detected spread-level fact. `strength` drives planner prioritization. */
export interface ArcanaSpreadSignal {
  kind: ArcanaSpreadSignalKind;
  strength: number;
  /** Spread indexes this signal is grounded in. */
  positions: number[];
  /** Machine-readable details the planner/phrasebooks can cite. */
  detail: {
    element?: ArcanaElement;
    secondElement?: ArcanaElement;
    suit?: ArcanaMinorSuit;
    relation?: ArcanaElementRelation;
    count?: number;
    direction?: ArcanaToneArcDirection;
    hingeRole?: ArcanaHingeRole;
    roles?: ArcanaCourtRole[];
    motion?: ArcanaMotion;
    number?: number;
  };
}

export interface ArcanaSpreadAnalysis {
  cards: ArcanaSemanticCard[];
  majorCount: number;
  reversedCount: number;
  elementCounts: Record<ArcanaElement, number>;
  suitCounts: Record<ArcanaMinorSuit, number>;
  dominantElement?: { element: ArcanaElement; count: number };
  /** Classical four elements entirely absent from the spread. */
  missingElements: ArcanaElement[];
  dominantSuit?: { suit: ArcanaMinorSuit; count: number };
  /** Positions holding an Ace. */
  aces: number[];
  /** Positions holding a court card. */
  courts: number[];
  /** All three element pairs with their relationships. */
  pairs: ArcanaElementPair[];
  toneArc: ArcanaToneArc;
  hingeRole: ArcanaHingeRole;
  /** All detected signals, sorted by strength (desc), then kind (stable). */
  signals: ArcanaSpreadSignal[];
}

// ---------------------------------------------------------------------------
// Signal detection helpers
// ---------------------------------------------------------------------------

const classicalElements: ArcanaElement[] = ['fire', 'water', 'air', 'earth'];

function countBy<T extends string>(items: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function buildPairs(cards: ArcanaSemanticCard[]): ArcanaElementPair[] {
  const pairs: ArcanaElementPair[] = [];
  for (let a = 0; a < cards.length; a += 1) {
    for (let b = a + 1; b < cards.length; b += 1) {
      const ea = cards[a].semantics.element;
      const eb = cards[b].semantics.element;
      pairs.push({
        a,
        b,
        elements: [ea, eb],
        relation: getArcanaElementRelation(ea, eb),
        adjacent: a === 1 || b === 1, // the hinge touches both outer cards
      });
    }
  }
  return pairs;
}

function buildToneArc(cards: ArcanaSemanticCard[]): ArcanaToneArc {
  const from = cards[0].semantics.tone;
  const hinge = cards[1].semantics.tone;
  const to = cards[2].semantics.tone;
  const delta = to - from;
  const average = (from + hinge + to) / 3;

  let direction: ArcanaToneArcDirection;
  if (delta >= 2) direction = 'rising';
  else if (delta <= -2) direction = 'falling';
  else if (average <= -1) direction = 'steady-dark';
  else if (average >= 1) direction = 'steady-bright';
  else direction = 'mixed';

  return { from, hinge, to, direction };
}

/**
 * The center card as the hinge of the spread: does it block a brighter arc,
 * redirect it, bridge the outer cards, or amplify one side?
 */
function resolveHingeRole(cards: ArcanaSemanticCard[], pairs: ArcanaElementPair[]): ArcanaHingeRole {
  const hinge = cards[1].semantics;
  const outerTones = [cards[0].semantics.tone, cards[2].semantics.tone];
  const brighterOuter = outerTones.some((tone) => tone >= 1);
  const hingePairs = pairs.filter((pair) => pair.adjacent);

  if (hinge.tone <= -1 && brighterOuter) return 'block';
  if (hinge.reversed && hinge.tone <= 0) return 'redirect';
  if (hingePairs.length === 2 && hingePairs.every((pair) => pair.relation === 'support')) return 'bridge';
  if (hingePairs.some((pair) => pair.relation === 'resonance')) return 'amplifier';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Main entry — analyzeArcanaSpread
// ---------------------------------------------------------------------------

/**
 * Analyze a three-card spread (foundation / hinge / opening order).
 * Deterministic and side-effect free.
 */
export function analyzeArcanaSpread(cards: ArcanaSemanticCard[]): ArcanaSpreadAnalysis {
  if (cards.length !== 3) {
    throw new Error(`analyzeArcanaSpread expects exactly 3 cards, got ${cards.length}`);
  }

  const signals: ArcanaSpreadSignal[] = [];
  const semantics = cards.map((card) => card.semantics);

  // --- Counts -------------------------------------------------------------
  const majorCount = semantics.filter((sem) => sem.group === 'major').length;
  const reversedCount = semantics.filter((sem) => sem.reversed).length;
  const elementCounts = countBy(semantics.map((sem) => sem.element));
  const suits = semantics.filter((sem) => sem.suit).map((sem) => sem.suit as ArcanaMinorSuit);
  const suitCounts = countBy(suits);
  const pairs = buildPairs(cards);
  const toneArc = buildToneArc(cards);
  const hingeRole = resolveHingeRole(cards, pairs);

  // --- Major Arcana ---------------------------------------------------------
  if (majorCount >= 2) {
    signals.push({
      kind: 'major-dominance',
      strength: 5 + majorCount,
      positions: semantics.map((sem, i) => (sem.group === 'major' ? i : -1)).filter((i) => i >= 0),
      detail: { count: majorCount },
    });
  }

  // --- Reversals ------------------------------------------------------------
  if (reversedCount >= 2) {
    signals.push({
      kind: 'reversal-concentration',
      strength: 5 + reversedCount,
      positions: semantics.map((sem, i) => (sem.reversed ? i : -1)).filter((i) => i >= 0),
      detail: { count: reversedCount },
    });
  }

  // --- Elements -------------------------------------------------------------
  const classicalCounts = classicalElements.map((element) => ({
    element,
    count: elementCounts[element] ?? 0,
  }));
  const dominant = classicalCounts.filter((entry) => entry.count >= 2).sort((a, b) => b.count - a.count)[0];
  const missingElements = classicalCounts.filter((entry) => entry.count === 0).map((entry) => entry.element);

  if (dominant) {
    signals.push({
      kind: 'element-dominance',
      strength: dominant.count === 3 ? 8 : 5,
      positions: semantics.map((sem, i) => (sem.element === dominant.element ? i : -1)).filter((i) => i >= 0),
      detail: { element: dominant.element, count: dominant.count },
    });
  }
  if (missingElements.length === 1 && dominant) {
    // "Exactly one classical element absent" is only interesting when another
    // current dominates the spread; otherwise it is background noise.
    signals.push({
      kind: 'element-missing',
      strength: 2,
      positions: [],
      detail: { element: missingElements[0] },
    });
  }

  for (const pair of pairs) {
    if (pair.relation === 'support') {
      signals.push({
        kind: 'element-support',
        strength: pair.adjacent ? 4 : 3,
        positions: [pair.a, pair.b],
        detail: { element: pair.elements[0], secondElement: pair.elements[1], relation: 'support' },
      });
    } else if (pair.relation === 'tension') {
      signals.push({
        kind: 'element-tension',
        strength: pair.adjacent ? 5 : 4,
        positions: [pair.a, pair.b],
        detail: { element: pair.elements[0], secondElement: pair.elements[1], relation: 'tension' },
      });
    }
  }

  // --- Suits ----------------------------------------------------------------
  const dominantSuit = (Object.entries(suitCounts) as Array<[ArcanaMinorSuit, number]>)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (dominantSuit) {
    const [suit, count] = dominantSuit;
    signals.push({
      kind: 'suit-repeat',
      strength: count === 3 ? 7 : 4,
      positions: semantics.map((sem, i) => (sem.suit === suit ? i : -1)).filter((i) => i >= 0),
      detail: { suit, count },
    });
  }


  // --- Aces & beginnings ------------------------------------------------------
  const aces = semantics.map((sem, i) => (sem.rank === 'ace' ? i : -1)).filter((i) => i >= 0);
  for (const index of aces) {
    if (semantics[index].reversed) {
      signals.push({
        kind: 'blocked-beginning',
        strength: 6,
        positions: [index],
        detail: { element: semantics[index].element },
      });
    } else {
      signals.push({
        kind: 'ace-present',
        strength: 5,
        positions: [index],
        detail: { element: semantics[index].element },
      });
    }
  }

  // --- Court cards ------------------------------------------------------------
  const courts = semantics.map((sem, i) => (sem.role ? i : -1)).filter((i) => i >= 0);
  if (courts.length >= 2) {
    signals.push({
      kind: 'court-dynamics',
      strength: 4 + courts.length,
      positions: courts,
      detail: {
        count: courts.length,
        roles: courts.map((i) => semantics[i].role as ArcanaCourtRole),
      },
    });
  }

  // --- Numbers ---------------------------------------------------------------
  const numbered = semantics
    .map((sem, i) => ({ index: i, number: sem.number }))
    .filter((entry): entry is { index: number; number: number } => typeof entry.number === 'number');
  const numberCounts = countBy(numbered.map((entry) => String(entry.number)));
  for (const [numberText, count] of Object.entries(numberCounts)) {
    if (count >= 2) {
      signals.push({
        kind: 'number-echo',
        strength: 4,
        positions: numbered.filter((entry) => String(entry.number) === numberText).map((entry) => entry.index),
        detail: { number: Number(numberText), count },
      });
    }
  }
  if (numbered.length === 3) {
    const values = numbered.map((entry) => entry.number);
    const ascending = values[1] === values[0] + 1 && values[2] === values[1] + 1;
    const descending = values[1] === values[0] - 1 && values[2] === values[1] - 1;
    if (ascending || descending) {
      signals.push({
        kind: 'number-sequence',
        strength: 6,
        positions: [0, 1, 2],
        detail: { direction: ascending ? 'rising' : 'falling' },
      });
    }
  }

  // --- Tone arc ---------------------------------------------------------------
  if (toneArc.direction !== 'mixed') {
    signals.push({
      kind: 'tone-arc',
      strength: toneArc.direction.startsWith('steady') ? 4 : 5,
      positions: [0, 1, 2],
      detail: { direction: toneArc.direction },
    });
  }

  // --- Motion arc ---------------------------------------------------------------
  const motions = semantics.map((sem) => sem.motion);
  const motionCounts = countBy(motions);
  const sharedMotion = (Object.entries(motionCounts) as Array<[ArcanaMotion, number]>)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (sharedMotion) {
    signals.push({
      kind: 'motion-arc',
      strength: sharedMotion[1] === 3 ? 6 : 3,
      positions: motions.map((motion, i) => (motion === sharedMotion[0] ? i : -1)).filter((i) => i >= 0),
      detail: { motion: sharedMotion[0], count: sharedMotion[1] },
    });
  }

  // --- Hinge ------------------------------------------------------------------
  if (hingeRole !== 'neutral') {
    signals.push({
      kind: 'hinge-role',
      strength: hingeRole === 'block' ? 5 : 3,
      positions: [1],
      detail: { hingeRole },
    });
  }

  // --- Sort: strongest first, stable by kind for determinism -----------------
  signals.sort((a, b) => b.strength - a.strength || a.kind.localeCompare(b.kind));

  return {
    cards,
    majorCount,
    reversedCount,
    elementCounts,
    suitCounts,
    dominantElement: dominant,
    missingElements,
    dominantSuit: dominantSuit ? { suit: dominantSuit[0], count: dominantSuit[1] } : undefined,
    aces,
    courts,
    pairs,
    toneArc,
    hingeRole,
    signals,
  };
}
