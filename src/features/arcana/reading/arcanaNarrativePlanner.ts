import type { ArcanaTopic } from '../types';
import type {
  ArcanaCourtRole,
  ArcanaElement,
  ArcanaMinorSuit,
  ArcanaMotion,
  ArcanaSemanticCard,
} from './arcanaCardSemantics';
import type {
  ArcanaHingeRole,
  ArcanaSpreadAnalysis,
  ArcanaSpreadSignal,
  ArcanaToneArc,
} from './arcanaSpreadAnalyzer';

// ---------------------------------------------------------------------------
// Arcana V2 — narrative planner
//
// Turns a SpreadAnalysis into a language-neutral ReadingPlan. This is where
// the *meaning* of the reading is decided — deterministically, from detected
// signals only. No randomness lives here; the phrasebooks may later pick
// between semantically equivalent phrasings, but they can never change the
// plan. The same plan therefore feeds both the English and Vietnamese
// composers (bilingual parity by construction).
// ---------------------------------------------------------------------------

export type ArcanaReadingStrategy =
  | 'major-turning-point'
  | 'elemental-dominance'
  | 'inner-block'
  | 'tension-and-resolution'
  | 'recovery'
  | 'escalation'
  | 'release'
  | 'stagnation'
  | 'new-beginning'
  | 'court-dynamics'
  | 'balanced-spread';

/** Semantic description of one card in its position (locale-free). */
export interface ArcanaPositionClaim {
  position: 'foundation' | 'hinge' | 'opening';
  cardId: string;
  reversed: boolean;
  element: ArcanaElement;
  suit?: ArcanaMinorSuit;
  tone: ArcanaToneArc['from'];
  motion: ArcanaMotion;
  /** Which of the card's localized keyword lists to draw from. */
  keywordSource: 'upright' | 'reversed';
  /** Indexes into that list — picked here so both locales use the same hooks. */
  keywordIndexes: number[];
  group: 'major' | 'minor';
  role?: ArcanaCourtRole;
  number?: number;
}

/** The single spread-level relationship the connection section will cite. */
export type ArcanaRelationshipClaim =
  | {
      kind: 'element-support' | 'element-tension';
      a: number;
      b: number;
      elements: [ArcanaElement, ArcanaElement];
    }
  | { kind: 'suit-repeat'; suit: ArcanaMinorSuit; positions: number[] }
  | { kind: 'element-dominance'; element: ArcanaElement; count: number }
  | { kind: 'reversal-concentration'; count: number; positions: number[] }
  | { kind: 'major-dominance'; count: number; positions: number[] }
  | { kind: 'tone-arc'; direction: ArcanaToneArc['direction'] }
  | { kind: 'number-echo'; number: number; positions: number[] }
  | { kind: 'number-sequence'; direction: 'rising' | 'falling' }
  | { kind: 'court-dynamics'; roles: ArcanaCourtRole[]; positions: number[] }
  | { kind: 'motion-shared'; motion: ArcanaMotion; positions: number[] }
  | { kind: 'triad' }; // fallback: read the three cards as one field

export type ArcanaReflectionKind =
  | 'blocked-beginning' // something new exists but cannot open yet
  | 'sustainable-step' // steady-dark loop -> a habit small enough to keep
  | 'integration' // two currents can feed each other
  | 'release' // set something down
  | 'choice' // a decision wants honesty
  | 'trust-the-turn' // rising arc — participate in the change
  | 'attention'; // neutral fallback — look where the hinge points

export interface ArcanaReflectionClaim {
  kind: ArcanaReflectionKind;
  /** Spread index the reflection is anchored to (named in prose). */
  focusIndex: number;
  /** Element phrasing hook (e.g. water -> "feeling"). */
  elementFocus?: ArcanaElement;
  /** Foundation element, when the question should bridge both ends. */
  foundationElement?: ArcanaElement;
  /** A shadow theme of the hinge card (localized at compose time). */
  hingeShadow?: string;
  topic: ArcanaTopic;
  arcDirection: ArcanaToneArc['direction'];
}

export interface ArcanaReadingPlan {
  strategy: ArcanaReadingStrategy;
  /** Card carrying the thesis of the whole reading. */
  centralThemeCardId: string;
  centralThemeKeywordIndex: number;
  centralThemeSource: 'upright' | 'reversed';
  foundationClaim: ArcanaPositionClaim;
  hingeClaim: ArcanaPositionClaim;
  openingClaim: ArcanaPositionClaim;
  hingeRole: ArcanaHingeRole;
  relationshipClaim: ArcanaRelationshipClaim;
  reflectionPrompt: ArcanaReflectionClaim;
  /** The 2-3 strongest signals this reading actually argues from. */
  evidence: ArcanaSpreadSignal[];
  arc: ArcanaToneArc;
}

// ---------------------------------------------------------------------------
// Strategy selection — scored, explicit, deterministic
// ---------------------------------------------------------------------------

export interface StrategyScore {
  strategy: ArcanaReadingStrategy;
  score: number;
}

function hasSignal(analysis: ArcanaSpreadAnalysis, kind: ArcanaSpreadSignal['kind']): boolean {
  return analysis.signals.some((signal) => signal.kind === kind);
}

function getSignal(analysis: ArcanaSpreadAnalysis, kind: ArcanaSpreadSignal['kind']): ArcanaSpreadSignal | undefined {
  return analysis.signals.find((signal) => signal.kind === kind);
}

/**
 * Rank the narrative patterns by how strongly the spread argues for them.
 * Deterministic: score desc, then strategy name for stability.
 */
export function scoreStrategies(analysis: ArcanaSpreadAnalysis): StrategyScore[] {
  const scores: StrategyScore[] = [];
  const arc = analysis.toneArc.direction;
  const reversedDark = analysis.reversedCount >= 2 && arc !== 'rising' && arc !== 'steady-bright';

  if (hasSignal(analysis, 'major-dominance')) {
    scores.push({ strategy: 'major-turning-point', score: 10 });
  }
  if (hasSignal(analysis, 'blocked-beginning') && analysis.reversedCount >= 2) {
    scores.push({ strategy: 'inner-block', score: 10 });
  } else if (reversedDark) {
    scores.push({ strategy: 'inner-block', score: 8 });
  }
  if (arc === 'rising') {
    scores.push({ strategy: 'recovery', score: analysis.toneArc.from < 0 ? 9 : 6 });
  }
  if (arc === 'falling') {
    scores.push({ strategy: 'escalation', score: analysis.toneArc.to < 0 ? 9 : 6 });
  }
  if (hasSignal(analysis, 'element-tension') && analysis.toneArc.to >= 0) {
    scores.push({ strategy: 'tension-and-resolution', score: 8 });
  }
  if (arc === 'steady-dark') {
    scores.push({ strategy: 'stagnation', score: 7 });
  }
  const motionSignal = getSignal(analysis, 'motion-arc');
  if (motionSignal?.detail.motion === 'release') {
    scores.push({ strategy: 'release', score: motionSignal.detail.count === 3 ? 8 : 5 });
  }
  if (hasSignal(analysis, 'ace-present') && !hasSignal(analysis, 'blocked-beginning')) {
    scores.push({ strategy: 'new-beginning', score: 6 });
  }
  if (hasSignal(analysis, 'court-dynamics')) {
    scores.push({ strategy: 'court-dynamics', score: 5 });
  }
  const dominance = getSignal(analysis, 'element-dominance');
  if (dominance) {
    scores.push({ strategy: 'elemental-dominance', score: dominance.detail.count === 3 ? 7 : 4 });
  }
  scores.push({ strategy: 'balanced-spread', score: 1 });

  return scores.sort((a, b) => b.score - a.score || a.strategy.localeCompare(b.strategy));
}


// ---------------------------------------------------------------------------
// Claim builders
// ---------------------------------------------------------------------------

const positionNames: Array<ArcanaPositionClaim['position']> = ['foundation', 'hinge', 'opening'];

function buildPositionClaim(card: ArcanaSemanticCard, index: number): ArcanaPositionClaim {
  const sem = card.semantics;
  return {
    position: positionNames[index],
    cardId: card.cardId,
    reversed: sem.reversed,
    element: sem.element,
    suit: sem.suit,
    tone: sem.tone,
    motion: sem.motion,
    keywordSource: sem.reversed ? 'reversed' : 'upright',
    keywordIndexes: [0, 1],
    group: sem.group,
    role: sem.role,
    number: sem.number,
  };
}

/**
 * Choose the ONE relationship the connection section will argue from.
 * Priority is explicit: positional tension beats outer tension, then support,
 * then structural echoes (suit, numbers, courts, motion), then arc/majors.
 */
function buildRelationshipClaim(analysis: ArcanaSpreadAnalysis): ArcanaRelationshipClaim {
  const byKind = (kind: ArcanaSpreadSignal['kind']) => getSignal(analysis, kind);
  const adjacent = (signal: ArcanaSpreadSignal | undefined) =>
    signal !== undefined && signal.positions.includes(1);

  const chosenTension =
    analysis.signals.find((signal) => signal.kind === 'element-tension' && adjacent(signal))
    ?? byKind('element-tension');
  if (chosenTension?.detail.element && chosenTension.detail.secondElement) {
    const [a, b] = chosenTension.positions;
    return {
      kind: 'element-tension',
      a,
      b,
      elements: [chosenTension.detail.element, chosenTension.detail.secondElement],
    };
  }

  const suitRepeat = byKind('suit-repeat');
  if (suitRepeat?.detail.suit) {
    return { kind: 'suit-repeat', suit: suitRepeat.detail.suit, positions: suitRepeat.positions };
  }

  const sequence = byKind('number-sequence');
  if (sequence?.detail.direction) {
    return { kind: 'number-sequence', direction: sequence.detail.direction as 'rising' | 'falling' };
  }

  const echo = byKind('number-echo');
  if (echo && typeof echo.detail.number === 'number') {
    return { kind: 'number-echo', number: echo.detail.number, positions: echo.positions };
  }

  const chosenSupport =
    analysis.signals.find((signal) => signal.kind === 'element-support' && adjacent(signal))
    ?? byKind('element-support');
  if (chosenSupport?.detail.element && chosenSupport.detail.secondElement) {
    const [a, b] = chosenSupport.positions;
    return {
      kind: 'element-support',
      a,
      b,
      elements: [chosenSupport.detail.element, chosenSupport.detail.secondElement],
    };
  }

  const courts = byKind('court-dynamics');
  if (courts?.detail.roles) {
    return { kind: 'court-dynamics', roles: courts.detail.roles, positions: courts.positions };
  }

  const motion = byKind('motion-arc');
  if (motion?.detail.motion) {
    return { kind: 'motion-shared', motion: motion.detail.motion, positions: motion.positions };
  }

  if (analysis.reversedCount >= 2) {
    const positions = analysis.cards
      .map((card, i) => (card.semantics.reversed ? i : -1))
      .filter((i) => i >= 0);
    return { kind: 'reversal-concentration', count: analysis.reversedCount, positions };
  }

  if (analysis.majorCount >= 2) {
    const positions = analysis.cards
      .map((card, i) => (card.semantics.group === 'major' ? i : -1))
      .filter((i) => i >= 0);
    return { kind: 'major-dominance', count: analysis.majorCount, positions };
  }

  const dominance = byKind('element-dominance');
  if (dominance?.detail.element) {
    return {
      kind: 'element-dominance',
      element: dominance.detail.element,
      count: dominance.detail.count ?? 2,
    };
  }

  if (analysis.toneArc.direction !== 'mixed') {
    return { kind: 'tone-arc', direction: analysis.toneArc.direction };
  }

  return { kind: 'triad' };
}


// ---------------------------------------------------------------------------
// Reflection selection — always derived from signals + arc + topic
// ---------------------------------------------------------------------------

function buildReflectionClaim(
  analysis: ArcanaSpreadAnalysis,
  strategy: ArcanaReadingStrategy,
  topic: ArcanaTopic,
): ArcanaReflectionClaim {
  const opening = analysis.cards[2].semantics;
  const hinge = analysis.cards[1].semantics;
  const arcDirection = analysis.toneArc.direction;
  const base = { topic, arcDirection };

  const blocked = getSignal(analysis, 'blocked-beginning');
  if (blocked) {
    return {
      ...base,
      kind: 'blocked-beginning',
      focusIndex: blocked.positions[0],
      elementFocus: blocked.detail.element,
      foundationElement: analysis.cards[0].semantics.element,
      hingeShadow: hinge.shadows[0],
    };
  }

  if (strategy === 'inner-block' || strategy === 'stagnation') {
    return {
      ...base,
      kind: 'sustainable-step',
      focusIndex: 2,
      elementFocus: opening.element,
      hingeShadow: hinge.shadows[0],
    };
  }

  if (strategy === 'tension-and-resolution') {
    const tension = getSignal(analysis, 'element-tension');
    return {
      ...base,
      kind: 'integration',
      focusIndex: tension?.positions[0] ?? 0,
      elementFocus: tension?.detail.element,
      foundationElement: tension?.detail.secondElement,
    };
  }

  if (strategy === 'release') {
    return {
      ...base,
      kind: 'release',
      focusIndex: 2,
      elementFocus: opening.element,
      hingeShadow: hinge.shadows[0],
    };
  }

  if (strategy === 'recovery') {
    return {
      ...base,
      kind: 'trust-the-turn',
      focusIndex: 2,
      elementFocus: opening.element,
    };
  }

  if (strategy === 'escalation') {
    return {
      ...base,
      kind: 'sustainable-step',
      focusIndex: 0,
      elementFocus: analysis.cards[0].semantics.element,
      hingeShadow: hinge.shadows[0],
    };
  }

  if (strategy === 'new-beginning') {
    return {
      ...base,
      kind: 'choice',
      focusIndex: analysis.aces[0] ?? 2,
      elementFocus: opening.element,
    };
  }

  // Fallback: an opening card whose motion is "release" still points at
  // setting something down — but only when no more specific strategy above
  // has already claimed the reflection.
  if (opening.motion === 'release') {
    return {
      ...base,
      kind: 'release',
      focusIndex: 2,
      elementFocus: opening.element,
      hingeShadow: hinge.shadows[0],
    };
  }

  return {
    ...base,
    kind: 'attention',
    focusIndex: 1,
    elementFocus: hinge.element,
    hingeShadow: hinge.shadows[0],
  };
}


// ---------------------------------------------------------------------------
// Evidence — the 2-3 signals the reading actually argues from
// ---------------------------------------------------------------------------

const evidencePriority: ArcanaSpreadSignal['kind'][] = [
  'major-dominance',
  'blocked-beginning',
  'reversal-concentration',
  'tone-arc',
  'element-tension',
  'element-support',
  'element-dominance',
  'suit-repeat',
  'ace-present',
  'number-sequence',
  'number-echo',
  'court-dynamics',
  'hinge-role',
  'motion-arc',
  'element-missing',
];

/** The signal kinds each strategy argues from — evidence starts here. */
const strategyDrivers: Record<ArcanaReadingStrategy, ArcanaSpreadSignal['kind'][]> = {
  'major-turning-point': ['major-dominance'],
  'inner-block': ['blocked-beginning', 'reversal-concentration'],
  'tension-and-resolution': ['element-tension'],
  recovery: ['tone-arc'],
  escalation: ['tone-arc'],
  stagnation: ['tone-arc', 'reversal-concentration'],
  release: ['motion-arc'],
  'new-beginning': ['ace-present'],
  'court-dynamics': ['court-dynamics'],
  'elemental-dominance': ['element-dominance'],
  'balanced-spread': [],
};

function buildEvidence(
  analysis: ArcanaSpreadAnalysis,
  strategy: ArcanaReadingStrategy,
): ArcanaSpreadSignal[] {
  const picked: ArcanaSpreadSignal[] = [];
  const push = (kind: ArcanaSpreadSignal['kind']) => {
    const signal = analysis.signals.find((candidate) => candidate.kind === kind);
    if (signal && !picked.includes(signal)) picked.push(signal);
  };
  for (const kind of strategyDrivers[strategy]) push(kind);
  for (const kind of evidencePriority) {
    if (picked.length >= 3) break;
    push(kind);
  }
  if (picked.length === 0 && analysis.signals.length > 0) {
    picked.push(analysis.signals[0]);
  }
  return picked.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Main entry — planArcanaReading
// ---------------------------------------------------------------------------

/**
 * Build the language-neutral semantic plan for a spread. Fully deterministic:
 * same analysis in -> same plan out, for every locale.
 */
export function planArcanaReading(
  analysis: ArcanaSpreadAnalysis,
  topic: ArcanaTopic,
): ArcanaReadingPlan {
  const strategy = scoreStrategies(analysis)[0].strategy;
  const arc = analysis.toneArc;

  // The thesis card is the strongest position among the spread: the hinge if
  // it strains, otherwise the opening (what the arc is moving toward).
  const thesisIndex = analysis.hingeRole === 'block' || analysis.hingeRole === 'redirect' ? 1 : 2;
  const thesisCard = analysis.cards[thesisIndex].semantics;

  return {
    strategy,
    centralThemeCardId: analysis.cards[thesisIndex].cardId,
    centralThemeKeywordIndex: 0,
    centralThemeSource: thesisCard.reversed ? 'reversed' : 'upright',
    foundationClaim: buildPositionClaim(analysis.cards[0], 0),
    hingeClaim: buildPositionClaim(analysis.cards[1], 1),
    openingClaim: buildPositionClaim(analysis.cards[2], 2),
    hingeRole: analysis.hingeRole,
    relationshipClaim: buildRelationshipClaim(analysis),
    reflectionPrompt: buildReflectionClaim(analysis, strategy, topic),
    evidence: buildEvidence(analysis, strategy),
    arc,
  };
}
