import type { ArcanaCardData, ArcanaText, ArcanaTextList } from './types';

// The 56 Minor Arcana, mapped to the JellyMod "minor" atlas (7 cols x 9 rows).
//
// Frame order assumed: standard Rider-Waite — Wands, Cups, Swords, Pentacles,
// each Ace, 2..10, Page, Knight, Queen, King (14 cards per suit). If the sheet
// uses a different order, adjust `suitOrder` / `rankOrder` below; nothing else
// needs to change.
//
// Content is built from suit + rank themes so every card reads naturally and
// distinctly in both languages, while staying compact and reflective.

type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

const suitOrder: Suit[] = ['wands', 'cups', 'swords', 'pentacles'];

// Rank slugs + bilingual display labels.
const rankOrder: Array<{ slug: string; en: string; vi: string }> = [
  { slug: 'ace', en: 'Ace', vi: 'Át' },
  { slug: 'two', en: 'Two', vi: 'Lá Hai' },
  { slug: 'three', en: 'Three', vi: 'Lá Ba' },
  { slug: 'four', en: 'Four', vi: 'Lá Bốn' },
  { slug: 'five', en: 'Five', vi: 'Lá Năm' },
  { slug: 'six', en: 'Six', vi: 'Lá Sáu' },
  { slug: 'seven', en: 'Seven', vi: 'Lá Bảy' },
  { slug: 'eight', en: 'Eight', vi: 'Lá Tám' },
  { slug: 'nine', en: 'Nine', vi: 'Lá Chín' },
  { slug: 'ten', en: 'Ten', vi: 'Lá Mười' },
  { slug: 'page', en: 'Page', vi: 'Tiểu Đồng' },
  { slug: 'knight', en: 'Knight', vi: 'Hiệp Sĩ' },
  { slug: 'queen', en: 'Queen', vi: 'Hoàng Hậu' },
  { slug: 'king', en: 'King', vi: 'Quốc Vương' },
];

const suitMeta: Record<Suit, {
  nameEn: string;
  nameVi: string;
  accent: string;
  element: ArcanaText;
  domain: ArcanaText;
}> = {
  wands: {
    nameEn: 'Wands',
    nameVi: 'Gậy',
    accent: '#ff9b5a',
    element: { en: 'fire', vi: 'lửa' },
    domain: { en: 'drive, passion, and creative energy', vi: 'động lực, đam mê và năng lượng sáng tạo' },
  },
  cups: {
    nameEn: 'Cups',
    nameVi: 'Cốc',
    accent: '#7ec8ff',
    element: { en: 'water', vi: 'nước' },
    domain: { en: 'emotion, relationships, and the heart', vi: 'cảm xúc, các mối quan hệ và trái tim' },
  },
  swords: {
    nameEn: 'Swords',
    nameVi: 'Kiếm',
    accent: '#c8d6e5',
    element: { en: 'air', vi: 'khí' },
    domain: { en: 'thought, truth, and communication', vi: 'tư duy, sự thật và giao tiếp' },
  },
  pentacles: {
    nameEn: 'Pentacles',
    nameVi: 'Tiền',
    accent: '#ffd96b',
    element: { en: 'earth', vi: 'đất' },
    domain: { en: 'work, money, and the material world', vi: 'công việc, tiền bạc và thế giới vật chất' },
  },
};

// Per-rank themes (upright + reversed), kept short and reflective.
const rankTheme: Record<string, {
  keywords: ArcanaTextList;
  upright: ArcanaText;
  reversedKeywords: ArcanaTextList;
  reversed: ArcanaText;
}> = {
  ace: {
    keywords: { en: ['new spark', 'potential', 'opening'], vi: ['tia khởi đầu', 'tiềm năng', 'cơ hội mở ra'] },
    upright: { en: 'a fresh seed of', vi: 'một mầm mới của' },
    reversedKeywords: { en: ['delayed start', 'blocked potential', 'hesitation'], vi: ['khởi đầu trì hoãn', 'tiềm năng bị chặn', 'chần chừ'] },
    reversed: { en: 'a beginning that stalls in', vi: 'một khởi đầu đang khựng lại trong' },
  },
  two: {
    keywords: { en: ['choice', 'balance', 'partnership'], vi: ['lựa chọn', 'cân bằng', 'đồng hành'] },
    upright: { en: 'a careful balancing of', vi: 'sự cân nhắc khéo léo giữa' },
    reversedKeywords: { en: ['imbalance', 'indecision', 'tension'], vi: ['mất cân bằng', 'lưỡng lự', 'căng thẳng'] },
    reversed: { en: 'a wobble in the balance of', vi: 'sự chông chênh trong cân bằng của' },
  },
  three: {
    keywords: { en: ['growth', 'collaboration', 'first results'], vi: ['phát triển', 'hợp tác', 'thành quả đầu'] },
    upright: { en: 'early growth and shared effort in', vi: 'sự lớn lên ban đầu và nỗ lực chung trong' },
    reversedKeywords: { en: ['setbacks', 'misalignment', 'delays'], vi: ['vấp váp', 'lệch nhịp', 'chậm trễ'] },
    reversed: { en: 'stalled progress in', vi: 'tiến triển bị chững trong' },
  },
  four: {
    keywords: { en: ['stability', 'rest', 'foundation'], vi: ['ổn định', 'nghỉ ngơi', 'nền tảng'] },
    upright: { en: 'a steadying and consolidation of', vi: 'sự ổn định và củng cố trong' },
    reversedKeywords: { en: ['stagnation', 'clinging', 'restlessness'], vi: ['trì trệ', 'bám giữ', 'bồn chồn'] },
    reversed: { en: 'a stuckness or clinging within', vi: 'sự mắc kẹt hoặc bám víu trong' },
  },
  five: {
    keywords: { en: ['challenge', 'conflict', 'loss'], vi: ['thử thách', 'xung đột', 'mất mát'] },
    upright: { en: 'a friction or testing within', vi: 'một va chạm hoặc thử thách trong' },
    reversedKeywords: { en: ['recovery', 'release', 'moving on'], vi: ['hồi phục', 'buông bỏ', 'bước tiếp'] },
    reversed: { en: 'a recovery beginning within', vi: 'sự hồi phục đang bắt đầu trong' },
  },
  six: {
    keywords: { en: ['harmony', 'support', 'progress'], vi: ['hài hòa', 'nâng đỡ', 'tiến lên'] },
    upright: { en: 'a return to harmony and movement in', vi: 'sự trở lại của hài hòa và chuyển động trong' },
    reversedKeywords: { en: ['imbalance in giving', 'stalling', 'lingering'], vi: ['lệch trong cho - nhận', 'chững lại', 'dùng dằng'] },
    reversed: { en: 'an imbalance lingering in', vi: 'một sự lệch lạc còn vương trong' },
  },
  seven: {
    keywords: { en: ['perseverance', 'assessment', 'patience'], vi: ['kiên trì', 'đánh giá lại', 'nhẫn nại'] },
    upright: { en: 'a moment of holding ground and weighing', vi: 'một lúc giữ vững lập trường và cân nhắc' },
    reversedKeywords: { en: ['doubt', 'overwhelm', 'giving up too soon'], vi: ['ngờ vực', 'quá tải', 'bỏ cuộc sớm'] },
    reversed: { en: 'doubt or overwhelm around', vi: 'sự ngờ vực hoặc quá tải quanh' },
  },
  eight: {
    keywords: { en: ['momentum', 'mastery', 'focus'], vi: ['đà tiến', 'thuần thục', 'tập trung'] },
    upright: { en: 'swift movement and dedication in', vi: 'sự chuyển động nhanh và tận tâm trong' },
    reversedKeywords: { en: ['scattered effort', 'delay', 'burnout'], vi: ['nỗ lực dàn trải', 'trì hoãn', 'kiệt sức'] },
    reversed: { en: 'scattered or stalled effort in', vi: 'nỗ lực dàn trải hoặc đình trệ trong' },
  },
  nine: {
    keywords: { en: ['resilience', 'near completion', 'reward'], vi: ['kiên cường', 'gần hoàn tất', 'phần thưởng'] },
    upright: { en: 'resilience and a nearing fulfillment in', vi: 'sự kiên cường và một thành tựu đang đến gần trong' },
    reversedKeywords: { en: ['anxiety', 'overcaution', 'fatigue'], vi: ['lo âu', 'thận trọng quá mức', 'mệt mỏi'] },
    reversed: { en: 'anxiety or weariness around', vi: 'sự lo âu hoặc mệt mỏi quanh' },
  },
  ten: {
    keywords: { en: ['completion', 'fullness', 'culmination'], vi: ['viên mãn', 'đủ đầy', 'đỉnh điểm'] },
    upright: { en: 'a culmination and fullness of', vi: 'đỉnh điểm và sự đủ đầy của' },
    reversedKeywords: { en: ['burden', 'overextension', 'release needed'], vi: ['gánh nặng', 'quá sức', 'cần buông'] },
    reversed: { en: 'an overload calling for release in', vi: 'một sự quá tải đang cần được buông trong' },
  },
  page: {
    keywords: { en: ['curiosity', 'learning', 'a message'], vi: ['tò mò', 'học hỏi', 'một tín hiệu'] },
    upright: { en: 'a curious, learning energy in', vi: 'một nguồn năng lượng tò mò, ham học trong' },
    reversedKeywords: { en: ['immaturity', 'distraction', 'blocked news'], vi: ['non nớt', 'xao nhãng', 'tin tức bị nghẽn'] },
    reversed: { en: 'restless or unfocused energy in', vi: 'năng lượng bồn chồn, thiếu tập trung trong' },
  },
  knight: {
    keywords: { en: ['action', 'pursuit', 'momentum'], vi: ['hành động', 'theo đuổi', 'đà tiến'] },
    upright: { en: 'bold, forward-moving energy in', vi: 'một nguồn năng lượng táo bạo, tiến về phía trước trong' },
    reversedKeywords: { en: ['haste', 'recklessness', 'stalling'], vi: ['vội vàng', 'liều lĩnh', 'chững lại'] },
    reversed: { en: 'haste or stalled drive in', vi: 'sự vội vàng hoặc động lực bị nghẽn trong' },
  },
  queen: {
    keywords: { en: ['nurturing mastery', 'depth', 'care'], vi: ['làm chủ dịu dàng', 'chiều sâu', 'quan tâm'] },
    upright: { en: 'a mature, caring command of', vi: 'sự làm chủ chín chắn và ân cần đối với' },
    reversedKeywords: { en: ['depletion', 'insecurity', 'self-neglect'], vi: ['cạn kiệt', 'bất an', 'bỏ quên mình'] },
    reversed: { en: 'depletion or insecurity around', vi: 'sự cạn kiệt hoặc bất an quanh' },
  },
  king: {
    keywords: { en: ['authority', 'mastery', 'leadership'], vi: ['quyền uy', 'bậc thầy', 'dẫn dắt'] },
    upright: { en: 'grounded mastery and leadership in', vi: 'sự làm chủ vững vàng và khả năng dẫn dắt trong' },
    reversedKeywords: { en: ['rigidity', 'control', 'misused power'], vi: ['cứng nhắc', 'kiểm soát', 'lạm quyền'] },
    reversed: { en: 'rigidity or misused control in', vi: 'sự cứng nhắc hoặc lạm dụng kiểm soát trong' },
  },
};

function buildMinorCard(suit: Suit, rankIndex: number, atlasIndex: number): ArcanaCardData {
  const rank = rankOrder[rankIndex];
  const meta = suitMeta[suit];
  const theme = rankTheme[rank.slug];

  const nameEn = `${rank.en} of ${meta.nameEn}`;
  const nameVi = `${rank.vi} ${meta.nameVi}`;

  return {
    id: `${rank.slug}-of-${suit}`,
    atlas: 'minor',
    atlasIndex,
    group: 'minor',
    suit,
    name: { en: nameEn, vi: nameVi },
    arcana: { en: `Minor Arcana · ${meta.nameEn}`, vi: `Ẩn Phụ · Bộ ${meta.nameVi}` },
    accent: meta.accent,
    keywords: theme.keywords,
    meaning: {
      en: `${nameEn} carries the element of ${meta.element.en}. It speaks of ${theme.upright.en} ${meta.domain.en}.`,
      vi: `${nameVi} mang nguyên tố ${meta.element.vi}. Lá bài nói về ${theme.upright.vi} ${meta.domain.vi}.`,
    },
    reversedKeywords: theme.reversedKeywords,
    reversedMeaning: {
      en: `Reversed, ${nameEn} points to ${theme.reversed.en} ${meta.domain.en}. Treat it as a gentle caution, not a verdict.`,
      vi: `Khi ngược, ${nameVi} chỉ về ${theme.reversed.vi} ${meta.domain.vi}. Hãy xem đó như một lời nhắc nhẹ, không phải một phán quyết.`,
    },
  };
}

export const arcanaMinorCards: ArcanaCardData[] = suitOrder.flatMap((suit, suitIndex) =>
  rankOrder.map((_, rankIndex) => buildMinorCard(suit, rankIndex, suitIndex * rankOrder.length + rankIndex)),
);
