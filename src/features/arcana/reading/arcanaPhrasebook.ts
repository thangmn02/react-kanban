import type { ArcanaQuestion, ArcanaTopic } from '../types';
import type { ArcanaSemanticCard } from './arcanaCardSemantics';
import type {
  ArcanaPositionClaim,
  ArcanaReadingPlan,
  ArcanaReflectionClaim,
} from './arcanaNarrativePlanner';

// ---------------------------------------------------------------------------
// Arcana V2 — phrasebook contract
//
// A phrasebook is pure language realization: it receives the language-neutral
// ReadingPlan plus the localized semantic cards, and renders prose. It must
// never change the meaning of the plan — only choose between semantically
// equivalent expressions (using the provided rng).
// ---------------------------------------------------------------------------

export interface ArcanaPhraseContext {
  rng: () => number;
  topic: ArcanaTopic;
  question: ArcanaQuestion;
  /** Localized semantic cards in spread order (0 foundation, 1 hinge, 2 opening). */
  cards: ArcanaSemanticCard[];
}

export interface ArcanaPhrasebook {
  /** Strategy-aware framing: question + topic + card names + central theme. */
  overview(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string;
  /** How one card behaves in its position (orientation- and motion-aware). */
  position(claim: ArcanaPositionClaim, ctx: ArcanaPhraseContext): string;
  /** Optional clause naming how an adjacent card affects this one. */
  adjacentNote(plan: ArcanaReadingPlan, index: number, ctx: ArcanaPhraseContext): string;
  /** The connection section: must cite the detected relationship claim. */
  connection(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string;
  /** The closing reflection: specific question or tiny action from the plan. */
  reflection(claim: ArcanaReflectionClaim, ctx: ArcanaPhraseContext): string;
  /** Short localized labels reused across sections. */
  positionLabel(index: number): string;
  orientationWord(reversed: boolean): string;
}

/** Deterministically pick one of several equivalent phrasings. */
export function pickPhrase<T>(items: T[], roll: number): T {
  return items[Math.floor(roll * items.length) % items.length];
}
