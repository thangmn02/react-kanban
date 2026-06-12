import { getArcanaCardById, getArcanaCardDisplay } from './arcanaCards';
import { createRng } from './arcanaRng';
import { arcanaSpreadLabels } from './arcanaSystems';
import type { ArcanaCorpusMatch } from './arcanaMessageEngine';
import type {
  ArcanaLocale,
  ArcanaQuestion,
  ArcanaSpreadCard,
  ArcanaSpreadPosition,
  ArcanaTopic,
} from './types';

// S9A — card-specific, question-specific 3-card reading engine.
//
// The reading is driven by the actual drawn cards, each card's position,
// upright/reversed orientation, the selected topic, and the selected question.
// The HF corpus (if matched) only sets `source`; its raw English text is never
// shown, so visible text always matches the chosen locale.

export type ArcanaReadingSource = 'hf_exact' | 'hf_partial' | 'template';

export interface ArcanaCardReadingPart {
  /** Localized spread-position label. */
  position: string;
  cardName: string;
  /** Localized orientation word (vi: "xuôi" | "ngược"). */
  orientation: string;
  text: string;
}

export interface ArcanaReadingContent {
  overview: string;
  cardReadings: [ArcanaCardReadingPart, ArcanaCardReadingPart, ArcanaCardReadingPart];
  connection: string;
  gentleMessage: string;
  source: ArcanaReadingSource;
}

// ---------------------------------------------------------------------------
// Topic lens — frames the interpretation domain (NOT productivity advice).
// ---------------------------------------------------------------------------

interface TopicLens {
  domain: string;
  facets: string[];
}

const topicLens: Record<ArcanaLocale, Record<ArcanaTopic, TopicLens>> = {
  vi: {
    work: { domain: 'công việc', facets: ['hướng đi', 'áp lực', 'cơ hội', 'sự hợp tác', 'một quyết định'] },
    love: { domain: 'tình cảm', facets: ['cảm xúc', 'sự kết nối', 'thời điểm', 'ranh giới', 'sự cởi mở', 'niềm tin'] },
    study: { domain: 'việc học', facets: ['sự tập trung', 'tính kỷ luật', 'áp lực', 'sự tự tin', 'điều còn mơ hồ'] },
    finance: { domain: 'tài chính', facets: ['sự an toàn', 'rủi ro', 'thói quen chi tiêu', 'việc cho và nhận', 'sự kiểm soát'] },
    self: { domain: 'bản thân', facets: ['trạng thái bên trong', 'sự tự tin', 'bản sắc', 'thói quen cảm xúc', 'sự chấp nhận'] },
    life: { domain: 'đời sống', facets: ['nhịp sống hằng ngày', 'sự nâng đỡ', 'một thay đổi', 'việc nghỉ ngơi', 'các mối quan hệ quanh bạn'] },
  },
  en: {
    work: { domain: 'work', facets: ['direction', 'pressure', 'opportunity', 'collaboration', 'a decision'] },
    love: { domain: 'love', facets: ['emotion', 'connection', 'timing', 'boundaries', 'openness', 'trust'] },
    study: { domain: 'study', facets: ['focus', 'discipline', 'pressure', 'confidence', 'what is still unclear'] },
    finance: { domain: 'finances', facets: ['security', 'risk', 'spending habits', 'giving and receiving', 'control'] },
    self: { domain: 'yourself', facets: ['your inner state', 'self-trust', 'identity', 'emotional patterns', 'acceptance'] },
    life: { domain: 'daily life', facets: ['daily rhythm', 'support', 'a change', 'rest', 'the people around you'] },
  },
};

// ---------------------------------------------------------------------------
// Position framing
// ---------------------------------------------------------------------------

const positionIntro: Record<ArcanaLocale, Record<ArcanaSpreadPosition, string[]>> = {
  vi: {
    past: ['Làm nền cho tất cả', 'Đặt móng cho câu chuyện', 'Ở lớp nền'],
    present: ['Điều đang cần bạn nhìn thẳng', 'Ngay lúc này', 'Điều rõ nhất hiện giờ'],
    future: ['Đang dần mở ra phía trước', 'Khi bước tiếp', 'Điều hé lộ ở phía trước'],
  },
  en: {
    past: ['Beneath it all', 'Laying the groundwork', 'At the foundation'],
    present: ['What asks to be seen now', 'Right now', 'Clearest in this moment'],
    future: ['Opening up ahead', 'As you move forward', 'Emerging on the path ahead'],
  },
};

function orientationWord(locale: ArcanaLocale, reversed: boolean): string {
  if (locale === 'vi') return reversed ? 'ngược' : 'xuôi';
  return reversed ? 'reversed' : 'upright';
}

function orientationClause(locale: ArcanaLocale, reversed: boolean): string {
  if (locale === 'vi') return reversed ? 'ở chiều nghịch' : 'theo chiều thuận';
  return reversed ? 'reversed' : 'upright';
}

function pick<T>(items: T[], roll: number): T {
  return items[Math.floor(roll * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Per-card reading
// ---------------------------------------------------------------------------

function buildCardPart(
  card: ArcanaSpreadCard,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  rng: () => number,
): ArcanaCardReadingPart {
  const data = getArcanaCardById(card.cardId);
  const display = data
    ? getArcanaCardDisplay(data, locale, card.orientation)
    : { name: card.cardName, keywords: [] as string[], meaning: '' };
  const reversed = card.orientation === 'reversed';
  const posLabel = arcanaSpreadLabels[locale][card.position];
  const intro = pick(positionIntro[locale][card.position], rng());
  const lens = topicLens[locale][topic];
  const facet = pick(lens.facets, rng());
  const clause = orientationClause(locale, reversed);
  const kw = display.keywords.slice(0, 2);
  const name = display.name;

  let text: string;
  if (locale === 'vi') {
    const variants = [
      `${intro}, ${name} ${clause} mang sắc thái ${kw.join(', ')}. ${display.meaning} Soi vào ${lens.domain}, lá này hướng bạn tới ${facet}.`,
      `Ở "${posLabel}", ${name} (${clause}) nói về ${kw.join(' và ')}. ${display.meaning} Với ${lens.domain}, đây là lời mời nhìn lại ${facet}.`,
      `${name} ${clause} rơi vào "${posLabel}", gợi lên ${kw[0] ?? ''}. ${display.meaning} Trong ${lens.domain}, hãy để ý ${facet}.`,
    ];
    text = pick(variants, rng());
  } else {
    const variants = [
      `${intro}, ${name} (${clause}) carries ${kw.join(', ')}. ${display.meaning} Seen through ${lens.domain}, it points you toward ${facet}.`,
      `At "${posLabel}", ${name} (${clause}) speaks of ${kw.join(' and ')}. ${display.meaning} For ${lens.domain}, it is an invitation to revisit ${facet}.`,
      `${name} (${clause}) lands on "${posLabel}", surfacing ${kw[0] ?? ''}. ${display.meaning} Within ${lens.domain}, notice ${facet}.`,
    ];
    text = pick(variants, rng());
  }

  return {
    position: posLabel,
    cardName: name,
    orientation: orientationWord(locale, reversed),
    text,
  };
}

// ---------------------------------------------------------------------------
// Overview / connection / gentle message
// ---------------------------------------------------------------------------

function buildOverview(
  parts: ArcanaCardReadingPart[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  rng: () => number,
): string {
  const [a, b, c] = parts.map((p) => p.cardName);
  const q = question.text[locale];
  const lens = topicLens[locale][topic];

  if (locale === 'vi') {
    const variants = [
      `Ba lá ${a}, ${b} và ${c} cùng soi vào câu hỏi "${q}" trong ${lens.domain}. Chúng không phán quyết, mà phác ra một mạch chuyện để bạn tự đối chiếu.`,
      `Với câu hỏi "${q}", bộ ba ${a} – ${b} – ${c} mở ra một góc nhìn về ${lens.domain}: từ điều làm nền, tới điều cần thấy rõ, rồi điều đang mở ra.`,
      `Quanh ${lens.domain}, ${a} và ${c} đóng khung câu chuyện, còn ${b} là bản lề. Tất cả cùng trả lời "${q}".`,
    ];
    return pick(variants, rng());
  }
  const variants = [
    `${a}, ${b} and ${c} together look into your question "${q}" within ${lens.domain}. They do not pass judgement; they sketch a thread for you to weigh.`,
    `For the question "${q}", the trio ${a} – ${b} – ${c} opens a view of ${lens.domain}: from the foundation, to what must be seen, to what is opening.`,
    `Around ${lens.domain}, ${a} and ${c} frame the story while ${b} is the hinge. Together they answer "${q}".`,
  ];
  return pick(variants, rng());
}

function buildConnection(
  parts: ArcanaCardReadingPart[],
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  cards: ArcanaSpreadCard[],
  rng: () => number,
): string {
  // Relate the foundation card to the opening card (most telling arc).
  const first = parts[0];
  const last = parts[2];
  const firstData = getArcanaCardById(cards[0].cardId);
  const lastData = getArcanaCardById(cards[2].cardId);
  const firstKw = firstData ? getArcanaCardDisplay(firstData, locale, cards[0].orientation).keywords[0] : '';
  const lastKw = lastData ? getArcanaCardDisplay(lastData, locale, cards[2].orientation).keywords[0] : '';
  const lens = topicLens[locale][topic];

  if (locale === 'vi') {
    const variants = [
      `Giữa ${first.cardName} và ${last.cardName} có một mạch nối: ${firstKw} ở phần nền gặp ${lastKw} đang mở ra, cho thấy ${lens.domain} của bạn đang chuyển từ một trạng thái sang một khả năng mới.`,
      `${first.cardName} và ${last.cardName} soi chiếu lẫn nhau — điều bắt đầu bằng ${firstKw} có thể chín thành ${lastKw}. ${parts[1].cardName} ở giữa nhắc bạn đừng bỏ qua bước chuyển ấy.`,
      `Hãy đọc ${first.cardName} cùng ${last.cardName} như một cặp: ${firstKw} và ${lastKw} không mâu thuẫn, mà là hai đầu của cùng một nhịp trong ${lens.domain}.`,
    ];
    return pick(variants, rng());
  }
  const variants = [
    `Between ${first.cardName} and ${last.cardName} runs a thread: ${firstKw} at the foundation meets ${lastKw} opening up, showing your ${lens.domain} shifting from one state into a new possibility.`,
    `${first.cardName} and ${last.cardName} mirror each other — what begins as ${firstKw} can ripen into ${lastKw}. ${parts[1].cardName} in the middle asks you not to skip that turn.`,
    `Read ${first.cardName} with ${last.cardName} as a pair: ${firstKw} and ${lastKw} are not at odds but two ends of one rhythm in ${lens.domain}.`,
  ];
  return pick(variants, rng());
}

function buildGentleMessage(
  parts: ArcanaCardReadingPart[],
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  rng: () => number,
): string {
  const opening = parts[2].cardName; // "what is opening"
  const present = parts[1].cardName;

  const vi: Record<ArcanaTopic, string[]> = {
    work: [
      `${opening} gợi rằng trong công việc, một bước đi thành thật còn quý hơn một kế hoạch hoàn hảo.`,
      `Hãy để ${present} nhắc bạn: chọn đúng việc để buông cũng là một quyết định.`,
    ],
    love: [
      `Hãy để ${opening} nhắc bạn rằng trong tình cảm, sự rõ ràng cần thời gian — đừng vội gọi tên mọi cảm xúc.`,
      `${present} mời bạn lắng nghe trước khi phản ứng; trái tim thường nói khẽ.`,
    ],
    study: [
      `${opening} cho thấy việc học của bạn tiến lên khi bạn tử tế với chính mình ở những lúc chưa hiểu.`,
      `Hãy để ${present} nhắc rằng một buổi học chậm mà rõ hơn nhiều buổi học vội.`,
    ],
    finance: [
      `${opening} gợi rằng với tiền bạc, một thói quen nhỏ bền bỉ mạnh hơn một quyết định lớn vội vàng.`,
      `Hãy để ${present} nhắc bạn phân biệt giữa điều cần và điều chỉ muốn.`,
    ],
    self: [
      `${opening} mời bạn đối xử với bản thân như với một người bạn quý — bằng sự kiên nhẫn.`,
      `Hãy để ${present} nhắc rằng bạn không cần hoàn hảo mới xứng đáng được nghỉ ngơi.`,
    ],
    life: [
      `${opening} gợi rằng đời sống dịu lại khi bạn giữ những gì nuôi dưỡng mình và nhẹ tay với phần còn lại.`,
      `Hãy để ${present} nhắc bạn rằng nghỉ ngơi cũng là một phần của tiến lên.`,
    ],
  };

  const en: Record<ArcanaTopic, string[]> = {
    work: [
      `${opening} suggests that at work, one honest step is worth more than a perfect plan.`,
      `Let ${present} remind you that choosing what to set down is also a decision.`,
    ],
    love: [
      `Let ${opening} remind you that in love, clarity takes time — don't rush to name every feeling.`,
      `${present} invites you to listen before reacting; the heart often speaks softly.`,
    ],
    study: [
      `${opening} shows your studies move forward when you are kind to yourself in the not-yet-understood moments.`,
      `Let ${present} remind you that one slow, clear session beats many rushed ones.`,
    ],
    finance: [
      `${opening} suggests that with money, a small steady habit outweighs a hasty big decision.`,
      `Let ${present} help you tell apart what you need from what you only want.`,
    ],
    self: [
      `${opening} invites you to treat yourself like a dear friend — with patience.`,
      `Let ${present} remind you that you need not be perfect to deserve rest.`,
    ],
    life: [
      `${opening} suggests life softens when you keep what nourishes you and go easy on the rest.`,
      `Let ${present} remind you that rest is part of moving forward too.`,
    ],
  };

  return pick(locale === 'vi' ? vi[topic] : en[topic], rng());
}

// ---------------------------------------------------------------------------
// Public composer
// ---------------------------------------------------------------------------

export function buildArcanaReading(
  spread: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  topic: ArcanaTopic,
  locale: ArcanaLocale,
  seed: string,
  corpus: ArcanaCorpusMatch | null,
): ArcanaReadingContent {
  const rng = createRng(`reading:${seed}:${locale}:${spread.map((c) => `${c.cardId}-${c.orientation}`).join('|')}`);

  const cardReadings = spread.map((card) => buildCardPart(card, topic, locale, rng)) as [
    ArcanaCardReadingPart,
    ArcanaCardReadingPart,
    ArcanaCardReadingPart,
  ];

  const overview = buildOverview(cardReadings, question, topic, locale, rng);
  let connection = buildConnection(cardReadings, topic, locale, spread, rng);
  const gentleMessage = buildGentleMessage(cardReadings, topic, locale, rng);

  const source: ArcanaReadingSource = corpus?.overlap === 3 ? 'hf_exact' : corpus ? 'hf_partial' : 'template';

  // HF corpus is used as an anchor SIGNAL only (never pasted; never shown in a
  // foreign language). When the exact trio is known, deepen the connection note.
  if (source === 'hf_exact') {
    connection += locale === 'vi'
      ? ' Bộ ba này cũng từng xuất hiện trong kho trải bài, nên mạch chuyện của nó càng rõ nét.'
      : ' This exact trio also appears in the reading archive, so its thread reads especially clearly.';
  }

  return { overview, cardReadings, connection, gentleMessage, source };
}

// ---------------------------------------------------------------------------
// Serialization — render to the section string used by the UI + history.
// Keeps the existing `messageSnapshot` contract (heading\nbody, blocks by \n\n).
// ---------------------------------------------------------------------------

const sectionHeadings: Record<ArcanaLocale, { overview: string; connection: string; gentle: string }> = {
  vi: { overview: 'Tổng quan ba lá', connection: 'Mối liên kết', gentle: 'Lời nhắn' },
  en: { overview: 'Overview', connection: 'The thread between them', gentle: 'A closing word' },
};

export function serializeArcanaReading(content: ArcanaReadingContent, locale: ArcanaLocale): string {
  const h = sectionHeadings[locale];
  const blocks: string[] = [`${h.overview}\n${content.overview}`];
  for (const part of content.cardReadings) {
    blocks.push(`${part.position} · ${part.cardName} (${part.orientation})\n${part.text}`);
  }
  blocks.push(`${h.connection}\n${content.connection}`);
  blocks.push(`${h.gentle}\n${content.gentleMessage}`);
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Anti-generic validation (dev/test helper)
// ---------------------------------------------------------------------------

const BANNED_GENERIC_LINE = 'Hãy giữ lại điều khiến bạn nhẹ lòng và đặt xuống điều khiến bạn nặng trĩu.';

export function validateReadingSpecificity(
  content: ArcanaReadingContent,
  drawnCards: ArcanaSpreadCard[],
  question: ArcanaQuestion,
  locale: ArcanaLocale = 'vi',
): string[] {
  const warnings: string[] = [];
  const names = drawnCards.map((c) => c.cardName);
  const countNames = (text: string) => names.filter((n) => n && text.includes(n)).length;

  if (countNames(content.overview) < 2) {
    warnings.push('overview must reference at least 2 card names');
  }
  content.cardReadings.forEach((part, i) => {
    if (!part.text.includes(part.cardName)) {
      warnings.push(`cardReadings[${i}] text must include its card name "${part.cardName}"`);
    }
  });
  if (countNames(content.connection) < 2) {
    warnings.push('connection must reference at least 2 card names');
  }
  const questionText = question.text[locale];
  if (questionText && !content.overview.includes(questionText)) {
    warnings.push('overview must reference the selected question');
  }
  if (countNames(content.gentleMessage) < 1) {
    warnings.push('gentleMessage must reference at least 1 card');
  }
  if (content.gentleMessage.includes(BANNED_GENERIC_LINE)) {
    warnings.push('gentleMessage uses a banned generic line');
  }

  if (warnings.length > 0 && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn('[arcana] reading specificity warnings:', warnings, { content, names });
  }
  return warnings;
}
