import type { ArcanaCorpusMatch } from '../arcanaMessageEngine';
import type {
  ArcanaCardReadingPart,
  ArcanaReadingContent,
  ArcanaReadingSource,
} from '../arcanaReadingEngine';
import { createRng } from '../arcanaRng';
import type {
  ArcanaLocale,
  ArcanaQuestion,
  ArcanaSpreadCard,
  ArcanaTopic,
} from '../types';
import { toSemanticSpread } from './arcanaCardSemantics';
import { analyzeArcanaSpread, type ArcanaSpreadAnalysis } from './arcanaSpreadAnalyzer';
import { planArcanaReading, type ArcanaReadingPlan } from './arcanaNarrativePlanner';
import type { ArcanaPhraseContext, ArcanaPhrasebook } from './arcanaPhrasebook';
import { arcanaPhrasebookEn } from './arcanaPhrasebook.en';
import { arcanaPhrasebookVi } from './arcanaPhrasebook.vi';

// ---------------------------------------------------------------------------
// Arcana V2 — reading composer
//
// Pipeline: Cards -> semantic profiles -> spread analysis -> narrative plan
// -> localized phrase rendering. The plan (not luck) decides the meaning; the
// rng only picks between semantically equivalent phrasings inside the chosen
// plan. Fully local and deterministic — no network, no AI calls.
// ---------------------------------------------------------------------------

/** Version stamped onto new readings so history knows which engine wrote them. */
export const arcanaReadingEngineVersionV2 = 2 as const;

export interface ArcanaReadingV2Result {
  content: ArcanaReadingContent;
  analysis: ArcanaSpreadAnalysis;
  plan: ArcanaReadingPlan;
}

function getPhrasebook(locale: ArcanaLocale): ArcanaPhrasebook {
  return locale === 'vi' ? arcanaPhrasebookVi : arcanaPhrasebookEn;
}

// ---------------------------------------------------------------------------
// Optional local HF corpus — motif signal only, never pasted raw into the UI.
// ---------------------------------------------------------------------------

interface CorpusMotif {
  pattern: RegExp;
  en: string;
  vi: string;
}

const corpusMotifs: CorpusMotif[] = [
  { pattern: /\b(choice|decision|option|crossroad|path)\b/i, en: 'choice', vi: 'sự lựa chọn' },
  { pattern: /\b(change|transform|transition|new beginning|renewal)\b/i, en: 'change', vi: 'sự chuyển hóa' },
  { pattern: /\b(balance|harmony|middle ground|moderation)\b/i, en: 'balance', vi: 'sự cân bằng' },
  { pattern: /\b(intuition|inner voice|instinct|within)\b/i, en: 'intuition', vi: 'trực giác' },
  { pattern: /\b(relationship|connection|love|heart|emotion)\b/i, en: 'connection', vi: 'sự kết nối' },
  { pattern: /\b(courage|strength|confidence|power)\b/i, en: 'inner strength', vi: 'sức mạnh nội tâm' },
  { pattern: /\b(abundance|security|stability|prosperity)\b/i, en: 'stability', vi: 'sự vững vàng' },
  { pattern: /\b(reflect|pause|rest|patience|wait)\b/i, en: 'quiet reflection', vi: 'khoảng lặng để soi lại' },
];

function detectCorpusMotifs(reading: string, locale: ArcanaLocale): string[] {
  return corpusMotifs
    .filter((motif) => motif.pattern.test(reading))
    .map((motif) => motif[locale])
    .slice(0, 2);
}

function buildCorpusSuffix(
  corpus: ArcanaCorpusMatch | null,
  source: ArcanaReadingSource,
  locale: ArcanaLocale,
): string {
  if (!corpus) return '';
  const motifs = detectCorpusMotifs(corpus.reading, locale);
  const motifText = motifs.join(locale === 'vi' ? ' và ' : ' and ');

  if (locale === 'vi') {
    if (source === 'hf_exact') {
      return motifText
        ? `Kho trải bài địa phương có một bản ghi khớp đúng bộ ba này, và nhịp của nó — ${motifText} — đi cùng hướng với cách đọc trên.`
        : 'Bộ ba này khớp đúng một bản ghi trong kho trải bài địa phương, nên mạch liên kết được giữ sát hình dáng của cả ba lá.';
    }
    return motifText
      ? `Kho trải bài địa phương chỉ khớp một phần, nhưng vẫn tô thêm sắc thái ${motifText}; cách đọc trên đứng vững trên cấu trúc của chính ba lá.`
      : 'Kho trải bài địa phương chỉ khớp một phần; cách đọc trên được giữ nguyên từ cấu trúc của chính ba lá.';
  }
  if (source === 'hf_exact') {
    return motifText
      ? `The local reading archive holds an exact match for this trio, and its emphases — ${motifText} — run in the same direction as the reading above.`
      : 'This exact trio appears in the local reading archive, so the thread above stays close to the shape of all three cards.';
  }
  return motifText
    ? `The local archive only partially matches this trio, but it still colors the reading toward ${motifText}; the reading above stands on the spread's own structure.`
    : "The local archive only partially matches this trio; the reading above stands on the spread's own structure.";
}

// ---------------------------------------------------------------------------
// Main entry — buildArcanaReadingV2 (+ a detailed variant for tests/dev)
// ---------------------------------------------------------------------------

export function buildArcanaReadingV2Detailed(
  spread: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  seed: string,
  corpus: ArcanaCorpusMatch | null,
): ArcanaReadingV2Result {
  const cards = toSemanticSpread(spread, locale);
  const analysis = analyzeArcanaSpread(cards);
  const plan = planArcanaReading(analysis, topic);
  const phrasebook = getPhrasebook(locale);
  const rng = createRng(
    `reading-v2:${seed}:${locale}:${spread.map((card) => `${card.cardId}-${card.orientation}`).join('|')}`,
  );
  const ctx: ArcanaPhraseContext = { rng, topic, question, cards };

  const overview = phrasebook.overview(plan, ctx);

  const claims = [plan.foundationClaim, plan.hingeClaim, plan.openingClaim];
  const cardReadings = claims.map((claim, index) => {
    const base = phrasebook.position(claim, ctx);
    const note = phrasebook.adjacentNote(plan, index, ctx);
    return {
      position: phrasebook.positionLabel(index),
      cardName: cards[index].name,
      orientation: phrasebook.orientationWord(cards[index].semantics.reversed),
      text: note ? `${base} ${note}` : base,
    };
  }) as [ArcanaCardReadingPart, ArcanaCardReadingPart, ArcanaCardReadingPart];

  const source: ArcanaReadingSource = corpus?.overlap === 3 ? 'hf_exact' : corpus ? 'hf_partial' : 'template';
  const corpusSuffix = buildCorpusSuffix(corpus, source, locale);
  const connection = corpusSuffix
    ? `${phrasebook.connection(plan, ctx)} ${corpusSuffix}`
    : phrasebook.connection(plan, ctx);

  const gentleMessage = phrasebook.reflection(plan.reflectionPrompt, ctx);

  return {
    content: { overview, cardReadings, connection, gentleMessage, source },
    analysis,
    plan,
  };
}

/** Compose a complete localized reading (same contract as the V1 composer). */
export function buildArcanaReadingV2(
  spread: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  seed: string,
  corpus: ArcanaCorpusMatch | null,
): ArcanaReadingContent {
  return buildArcanaReadingV2Detailed(spread, question, topic, locale, seed, corpus).content;
}
