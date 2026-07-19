import { getArcanaCardById, getArcanaCardDisplay } from '../arcanaCards';
import type {
  ArcanaCard,
  ArcanaLocale,
  ArcanaOrientation,
  ArcanaSpreadCard,
  ArcanaSpreadPosition,
} from '../types';

// ---------------------------------------------------------------------------
// Arcana V2 — card semantic layer
//
// A compact, spread-reasoning-oriented view of each of the 78 cards. It does
// NOT duplicate the existing bilingual meanings/keywords: prose themes and
// shadows are reused from the card catalog; this module only adds the metadata
// required for spread-level reasoning (element, tone, motion, number, court
// role) plus short editorial "advice" hints used when composing reflections.
//
// Everything is deterministic and locale-aware: `themes`/`shadows`/`advice`
// come back localized, while element/tone/motion/number/role are locale-free
// so a single language-neutral spread analysis can feed both phrasebooks.
// ---------------------------------------------------------------------------

export type ArcanaElement = 'fire' | 'water' | 'air' | 'earth' | 'spirit';

/** Coarse emotional valence of the card *as drawn* (orientation applied). */
export type ArcanaTone = -2 | -1 | 0 | 1 | 2;

/** Where the card sits in a natural cycle of change. */
export type ArcanaMotion = 'begin' | 'grow' | 'pause' | 'release' | 'complete';

/** Court-card role (Page / Knight / Queen / King). */
export type ArcanaCourtRole = 'student' | 'messenger' | 'actor' | 'master';

export type ArcanaMinorSuit = 'wands' | 'cups' | 'swords' | 'pentacles';

export interface ArcanaCardSemantics {
  cardId: string;
  group: 'major' | 'minor';
  suit?: ArcanaMinorSuit;
  element: ArcanaElement;
  /** Orientation-adjusted tone: reversed profiles are applied by the resolver. */
  tone: ArcanaTone;
  motion: ArcanaMotion;
  /** Localized, orientation-adjusted theme keywords (reused from the catalog). */
  themes: string[];
  /** Localized shadow keywords — what to watch when this card strains. */
  shadows: string[];
  /** Localized short action hints tied to this card's energy. */
  advice: string[];
  /** Pip number for Minor Arcana (1..10). */
  number?: number;
  /** Rank slug for Minor Arcana ('ace'..'king'). */
  rank?: string;
  role?: ArcanaCourtRole;
  reversed: boolean;
  /** First upright theme — a stable hook for composing prose. */
  uprightTheme: string;
  /** First reversed theme — a stable hook for the card's shadow side. */
  reversedTheme: string;
}

/** A drawn spread card enriched with its semantic profile + display fields. */
export interface ArcanaSemanticCard {
  position: ArcanaSpreadPosition;
  cardId: string;
  orientation: ArcanaOrientation;
  /** Localized display name. */
  name: string;
  /** Localized orientation-adjusted meaning sentence from the catalog. */
  meaning: string;
  semantics: ArcanaCardSemantics;
}

// ---------------------------------------------------------------------------
// Minor Arcana — derived from suit + rank (nothing duplicated by hand)
// ---------------------------------------------------------------------------

const suitElement: Record<ArcanaMinorSuit, ArcanaElement> = {
  wands: 'fire',
  cups: 'water',
  swords: 'air',
  pentacles: 'earth',
};

interface RankSemantics {
  number?: number;
  role?: ArcanaCourtRole;
  motion: ArcanaMotion;
  uprightTone: ArcanaTone;
  reversedTone: ArcanaTone;
}

// Tones follow the existing rankTheme content in arcanaMinorCards.ts: a
// reversed Five is explicitly "a recovery beginning" (so it lightens), while a
// reversed Ten is "an overload calling for release" (so it darkens further).
const rankSemantics: Record<string, RankSemantics> = {
  ace: { number: 1, motion: 'begin', uprightTone: 2, reversedTone: -1 },
  two: { number: 2, motion: 'pause', uprightTone: 0, reversedTone: -1 },
  three: { number: 3, motion: 'grow', uprightTone: 1, reversedTone: -1 },
  four: { number: 4, motion: 'pause', uprightTone: 0, reversedTone: -1 },
  five: { number: 5, motion: 'release', uprightTone: -2, reversedTone: 1 },
  six: { number: 6, motion: 'grow', uprightTone: 1, reversedTone: -1 },
  seven: { number: 7, motion: 'pause', uprightTone: 0, reversedTone: -1 },
  eight: { number: 8, motion: 'grow', uprightTone: 1, reversedTone: -1 },
  nine: { number: 9, motion: 'complete', uprightTone: 1, reversedTone: -1 },
  ten: { number: 10, motion: 'complete', uprightTone: 1, reversedTone: -2 },
  page: { role: 'student', motion: 'begin', uprightTone: 1, reversedTone: -1 },
  knight: { role: 'messenger', motion: 'grow', uprightTone: 1, reversedTone: -1 },
  queen: { role: 'actor', motion: 'complete', uprightTone: 1, reversedTone: -1 },
  king: { role: 'master', motion: 'complete', uprightTone: 2, reversedTone: -1 },
};

// ---------------------------------------------------------------------------
// Major Arcana — compact per-card table (metadata only; prose stays in the
// catalog). Elements follow the classic Golden Dawn astrological mapping so
// elemental reasoning stays meaningful when Majors meet Minors.
// ---------------------------------------------------------------------------

interface MajorSemantics {
  element: ArcanaElement;
  motion: ArcanaMotion;
  uprightTone: ArcanaTone;
  reversedTone: ArcanaTone;
}

const majorSemantics: Record<string, MajorSemantics> = {
  'the-fool': { element: 'air', motion: 'begin', uprightTone: 1, reversedTone: -1 },
  'the-magician': { element: 'air', motion: 'begin', uprightTone: 2, reversedTone: -1 },
  'the-high-priestess': { element: 'water', motion: 'pause', uprightTone: 1, reversedTone: -1 },
  'the-empress': { element: 'earth', motion: 'grow', uprightTone: 2, reversedTone: -1 },
  'the-emperor': { element: 'fire', motion: 'pause', uprightTone: 1, reversedTone: -1 },
  'the-hierophant': { element: 'earth', motion: 'pause', uprightTone: 1, reversedTone: -1 },
  'the-lovers': { element: 'air', motion: 'grow', uprightTone: 2, reversedTone: -1 },
  'the-chariot': { element: 'water', motion: 'grow', uprightTone: 2, reversedTone: -1 },
  strength: { element: 'fire', motion: 'pause', uprightTone: 2, reversedTone: -1 },
  'the-hermit': { element: 'earth', motion: 'pause', uprightTone: 0, reversedTone: -1 },
  'wheel-of-fortune': { element: 'fire', motion: 'begin', uprightTone: 0, reversedTone: -1 },
  justice: { element: 'air', motion: 'pause', uprightTone: 0, reversedTone: -1 },
  'the-hanged-man': { element: 'water', motion: 'pause', uprightTone: -1, reversedTone: -1 },
  death: { element: 'water', motion: 'release', uprightTone: -1, reversedTone: -1 },
  temperance: { element: 'fire', motion: 'pause', uprightTone: 1, reversedTone: -1 },
  // Reversed Devil is explicitly "release / breaking free" in the catalog, so
  // the reversal lightens rather than darkens.
  'the-devil': { element: 'earth', motion: 'release', uprightTone: -2, reversedTone: 1 },
  'the-tower': { element: 'fire', motion: 'release', uprightTone: -2, reversedTone: -1 },
  'the-star': { element: 'air', motion: 'grow', uprightTone: 2, reversedTone: -1 },
  // Reversed Moon is "the fog is lifting" — a relief, modeled as a lift.
  'the-moon': { element: 'water', motion: 'pause', uprightTone: -1, reversedTone: 1 },
  'the-sun': { element: 'fire', motion: 'grow', uprightTone: 2, reversedTone: -1 },
  judgement: { element: 'fire', motion: 'begin', uprightTone: 1, reversedTone: -1 },
  'the-world': { element: 'earth', motion: 'complete', uprightTone: 2, reversedTone: -1 },
};


// ---------------------------------------------------------------------------
// Advice hints — the only hand-written prose in this layer. Keyed by rank for
// Minors and by id for Majors; kept short and action-shaped so reflections can
// borrow them without sounding generic.
// ---------------------------------------------------------------------------

const minorAdviceByRank: Record<string, { en: string[]; vi: string[] }> = {
  ace: {
    en: ['give the new spark one small, real container'],
    vi: ['đặt tia lửa mới vào một chiếc nôi nhỏ mà thật'],
  },
  two: {
    en: ['name both sides of the scale before choosing'],
    vi: ['gọi tên cả hai phía của cán cân trước khi chọn'],
  },
  three: {
    en: ['share the early draft instead of perfecting it alone'],
    vi: ['chia sẻ bản nháp đầu thay vì mài một mình đến hoàn hảo'],
  },
  four: {
    en: ['loosen one grip and notice what stays'],
    vi: ['nới lỏng một cái nắm và xem điều gì vẫn ở lại'],
  },
  five: {
    en: ['accept one offered hand instead of enduring alone'],
    vi: ['nhận lấy một bàn tay đang chìa ra thay vì cam chịu một mình'],
  },
  six: {
    en: ['let giving and receiving move in both directions'],
    vi: ['để việc cho và nhận chảy được cả hai chiều'],
  },
  seven: {
    en: ['hold your ground on the one thing that matters most'],
    vi: ['giữ vững ở một điểm quan trọng nhất thay vì mọi mặt trận'],
  },
  eight: {
    en: ['return to one repeatable practice'],
    vi: ['quay lại một thói quen có thể lặp lại'],
  },
  nine: {
    en: ['acknowledge how far you have already carried this'],
    vi: ['ghi nhận quãng đường bạn đã tự mang đi được'],
  },
  ten: {
    en: ['put down what was never yours to carry'],
    vi: ['đặt xuống phần gánh vốn không thuộc về bạn'],
  },
  page: {
    en: ['ask the beginner question out loud'],
    vi: ['hỏi to câu hỏi của người mới bắt đầu'],
  },
  knight: {
    en: ['move, but choose the direction before the speed'],
    vi: ['cứ tiến, nhưng chọn hướng trước rồi mới chọn tốc độ'],
  },
  queen: {
    en: ['care for it the way you would care for someone you love'],
    vi: ['chăm sóc nó như cách bạn chăm sóc một người mình thương'],
  },
  king: {
    en: ['set the rule you are actually willing to keep'],
    vi: ['đặt ra nguyên tắc mà bạn thực sự sẵn lòng giữ'],
  },
};

const majorAdvice: Record<string, { en: string[]; vi: string[] }> = {
  'the-fool': { en: ['take the first step before the whole path is visible'], vi: ['bước chân đầu tiên trước khi thấy trọn con đường'] },
  'the-magician': { en: ['aim every tool you already have at one clear point'], vi: ['dồn mọi công cụ sẵn có vào một điểm rõ ràng'] },
  'the-high-priestess': { en: ['listen for the answer that arrives quietly'], vi: ['lắng nghe câu trả lời đến một cách lặng lẽ'] },
  'the-empress': { en: ['tend what wants to grow instead of forcing it'], vi: ['chăm điều đang muốn lớn thay vì ép nó lớn'] },
  'the-emperor': { en: ['build one boundary you can actually keep'], vi: ['dựng một ranh giới mà bạn thực sự giữ nổi'] },
  'the-hierophant': { en: ['ask someone who has walked this path before'], vi: ['hỏi một người đã từng đi qua con đường này'] },
  'the-lovers': { en: ['choose from your truest value, not the loudest fear'], vi: ['chọn từ giá trị thật nhất, không phải nỗi sợ ồn ào nhất'] },
  'the-chariot': { en: ['pick one direction and hold the reins steady'], vi: ['chọn một hướng và giữ dây cương thật vững'] },
  strength: { en: ['meet the hard thing gently instead of wrestling it'], vi: ['đối diện điều khó một cách dịu dàng thay vì vật lộn'] },
  'the-hermit': { en: ['take one honest hour alone with the question'], vi: ['dành một giờ thành thật ở một mình với câu hỏi'] },
  'wheel-of-fortune': { en: ['read the timing instead of fighting the turn'], vi: ['đọc thời điểm thay vì chống lại vòng xoay'] },
  justice: { en: ['name what is actually true, without decoration'], vi: ['gọi tên điều thực sự đúng, không tô vẽ'] },
  'the-hanged-man': { en: ['stop pushing and look from the other side'], vi: ['ngừng đẩy và nhìn từ phía bên kia'] },
  death: { en: ['let the finished chapter actually end'], vi: ['để chương đã hết thực sự khép lại'] },
  temperance: { en: ['mix slowly; adjust by small amounts'], vi: ['pha trộn chậm rãi; chỉnh từng chút một'] },
  'the-devil': { en: ['name the cord before you try to cut it'], vi: ['gọi tên sợi dây trước khi tìm cách cắt nó'] },
  'the-tower': { en: ['let what is already shaking fall safely'], vi: ['để điều đang lung lay được ngã an toàn'] },
  'the-star': { en: ['protect one small hope and feed it daily'], vi: ['giữ lấy một hy vọng nhỏ và nuôi nó mỗi ngày'] },
  'the-moon': { en: ['let feelings pass through without signing the story they tell'], vi: ['để cảm xúc trôi qua mà không ký tên vào câu chuyện chúng kể'] },
  'the-sun': { en: ['let the good thing be simple and visible'], vi: ['để điều tốt được giản dị và hiển nhiên'] },
  judgement: { en: ['answer the call you have been hearing for a while'], vi: ['đáp lại tiếng gọi bạn đã nghe thấy từ lâu'] },
  'the-world': { en: ['close the loop before opening the next one'], vi: ['khép trọn vòng này trước khi mở vòng tiếp theo'] },
};


// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

function resolveMinorSemantics(
  card: ArcanaCard,
  orientation: ArcanaOrientation,
  locale: ArcanaLocale,
): ArcanaCardSemantics {
  const rank = card.id.split('-of-')[0];
  const suit = card.suit as ArcanaMinorSuit;
  const rankMeta = rankSemantics[rank];
  const reversed = orientation === 'reversed';
  const display = getArcanaCardDisplay(card, locale, orientation);
  const uprightDisplay = getArcanaCardDisplay(card, locale, 'upright');
  const reversedDisplay = getArcanaCardDisplay(card, locale, 'reversed');
  const advicePool = minorAdviceByRank[rank]?.[locale] ?? [];

  return {
    cardId: card.id,
    group: 'minor',
    suit,
    element: suitElement[suit],
    tone: reversed ? rankMeta.reversedTone : rankMeta.uprightTone,
    motion: rankMeta.motion,
    themes: display.keywords,
    shadows: reversedDisplay.keywords,
    advice: advicePool,
    number: rankMeta.number,
    rank,
    role: rankMeta.role,
    reversed,
    uprightTheme: uprightDisplay.keywords[0] ?? '',
    reversedTheme: reversedDisplay.keywords[0] ?? '',
  };
}

function resolveMajorSemantics(
  card: ArcanaCard,
  orientation: ArcanaOrientation,
  locale: ArcanaLocale,
): ArcanaCardSemantics {
  const meta = majorSemantics[card.id] ?? { element: 'spirit' as ArcanaElement, motion: 'pause' as ArcanaMotion, uprightTone: 0 as ArcanaTone, reversedTone: -1 as ArcanaTone };
  const reversed = orientation === 'reversed';
  const display = getArcanaCardDisplay(card, locale, orientation);
  const uprightDisplay = getArcanaCardDisplay(card, locale, 'upright');
  const reversedDisplay = getArcanaCardDisplay(card, locale, 'reversed');

  return {
    cardId: card.id,
    group: 'major',
    element: meta.element,
    tone: reversed ? meta.reversedTone : meta.uprightTone,
    motion: meta.motion,
    themes: display.keywords,
    shadows: reversedDisplay.keywords,
    advice: majorAdvice[card.id]?.[locale] ?? [],
    reversed,
    uprightTheme: uprightDisplay.keywords[0] ?? '',
    reversedTheme: reversedDisplay.keywords[0] ?? '',
  };
}

/** Resolve the semantic profile of one card as drawn (orientation applied). */
export function getArcanaCardSemantics(
  cardId: string,
  orientation: ArcanaOrientation,
  locale: ArcanaLocale,
): ArcanaCardSemantics {
  const card = getArcanaCardById(cardId);
  if (!card) {
    // Unknown id (e.g. legacy data): neutral spirit profile, no crash.
    return {
      cardId,
      group: 'major',
      element: 'spirit',
      tone: 0,
      motion: 'pause',
      themes: [],
      shadows: [],
      advice: [],
      reversed: orientation === 'reversed',
      uprightTheme: '',
      reversedTheme: '',
    };
  }
  if (card.group === 'minor' && card.suit) {
    return resolveMinorSemantics(card, orientation, locale);
  }
  return resolveMajorSemantics(card, orientation, locale);
}

/** Enrich a drawn spread card with semantics + localized display fields. */
export function toSemanticCard(card: ArcanaSpreadCard, locale: ArcanaLocale): ArcanaSemanticCard {
  const data = getArcanaCardById(card.cardId);
  const display = data ? getArcanaCardDisplay(data, locale, card.orientation) : null;
  return {
    position: card.position,
    cardId: card.cardId,
    orientation: card.orientation,
    name: display?.name ?? card.cardName,
    meaning: display?.meaning ?? '',
    semantics: getArcanaCardSemantics(card.cardId, card.orientation, locale),
  };
}

/** Enrich a full spread (position order preserved). */
export function toSemanticSpread(cards: ArcanaSpreadCard[], locale: ArcanaLocale): ArcanaSemanticCard[] {
  return cards.map((card) => toSemanticCard(card, locale));
}
