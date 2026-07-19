import type { ArcanaCorpusMatch } from '../arcanaMessageEngine';
import { buildArcanaReading, serializeArcanaReading } from '../arcanaReadingEngine';
import type {
  ArcanaLocale,
  ArcanaQuestion,
  ArcanaSpreadCard,
  ArcanaTopic,
} from '../types';
import type { ArcanaReadingStrategy } from './arcanaNarrativePlanner';
import { buildArcanaReadingV2Detailed } from './arcanaReadingComposerV2';

// ---------------------------------------------------------------------------
// Development-only V1/V2 comparison path.
//
// Used by the ritual flow in DEV mode to print both engines' readings for the
// same spread side by side, so V2 can be reviewed against V1 without any risk
// of changing what users see. Not called in production builds (tree-shaken
// call site), and it never mutates state.
// ---------------------------------------------------------------------------

export interface ArcanaEngineComparison {
  strategy: ArcanaReadingStrategy;
  signals: string[];
  v1: string;
  v2: string;
}

export function compareArcanaReadingEngines(
  spread: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  seed: string,
  corpus: ArcanaCorpusMatch | null,
): ArcanaEngineComparison {
  const v1Content = buildArcanaReading(spread, question, topic, locale, seed, corpus);
  const v2 = buildArcanaReadingV2Detailed(spread, question, topic, locale, seed, corpus);
  return {
    strategy: v2.plan.strategy,
    signals: v2.plan.evidence.map((signal) => signal.kind),
    v1: serializeArcanaReading(v1Content, locale),
    v2: serializeArcanaReading(v2.content, locale),
  };
}

/** Console side-by-side diff for developers; no-op outside DEV. */
export function logArcanaEngineComparison(
  spread: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  seed: string,
  corpus: ArcanaCorpusMatch | null,
): void {
  if (!import.meta.env.DEV) return;
  const comparison = compareArcanaReadingEngines(spread, question, topic, locale, seed, corpus);
  console.groupCollapsed(
    `[arcana] engine comparison — strategy: ${comparison.strategy} | signals: ${comparison.signals.join(', ')}`,
  );
  console.log('--- V1 (template engine) ---\n' + comparison.v1);
  console.log('--- V2 (semantic engine) ---\n' + comparison.v2);
  console.groupEnd();
}
