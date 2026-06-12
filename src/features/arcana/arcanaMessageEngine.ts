import { createRng } from './arcanaRng';
import {
  findExactCombo,
  findFallbackCandidates,
  loadHFTarotCorpus,
  loadHFTarotIndex,
} from './hfTarotData';

// HF (Hugging Face) tarot corpus retrieval.
//
// The English corpus is used ONLY as an anchor signal for the reading engine
// (see arcanaReadingEngine.ts) — its raw text is never displayed, so visible
// reading text always matches the chosen locale. The generic per-spread text
// composer was removed in S9A in favor of the card-specific engine.

/** Result of locating an interpretation in the HF corpus. */
export interface ArcanaCorpusMatch {
  reading: string;
  /** 3 = exact combo, 1-2 = overlap fallback. */
  overlap: number;
}

/**
 * Find a corpus interpretation for the spread: exact unordered 3-card combo
 * first, otherwise the best 2-card then 1-card overlap. Deterministic via seed.
 * Returns null if the corpus is unavailable or no card overlaps.
 */
export async function findCorpusReading(
  slugs: string[],
  seed: string,
): Promise<ArcanaCorpusMatch | null> {
  try {
    const index = await loadHFTarotIndex();
    const exact = findExactCombo(index, slugs);

    let chosenId: number | undefined;
    let overlap = 3;

    if (exact.length > 0) {
      const rng = createRng(`corpus-exact:${seed}`);
      chosenId = exact[Math.floor(rng() * exact.length)];
    } else {
      const candidates = findFallbackCandidates(index, slugs, 20);
      if (candidates.length > 0) {
        const rng = createRng(`corpus-fallback:${seed}`);
        const top = candidates.filter((c) => c.overlap === candidates[0].overlap);
        const chosen = top[Math.floor(rng() * top.length)];
        chosenId = chosen.id;
        overlap = chosen.overlap;
      }
    }

    if (chosenId === undefined) return null;
    const corpus = await loadHFTarotCorpus();
    const row = corpus[chosenId];
    if (!row) return null;
    return { reading: row.reading, overlap };
  } catch {
    return null;
  }
}
