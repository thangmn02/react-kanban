import { arcanaSpreadLabels } from '../arcanaSystems';
import type { ArcanaTopic } from '../types';
import type { ArcanaElement, ArcanaMinorSuit, ArcanaMotion } from './arcanaCardSemantics';
import type {
  ArcanaPositionClaim,
  ArcanaReadingPlan,
  ArcanaReflectionClaim,
  ArcanaRelationshipClaim,
} from './arcanaNarrativePlanner';
import { pickPhrase, type ArcanaPhraseContext, type ArcanaPhrasebook } from './arcanaPhrasebook';

// ---------------------------------------------------------------------------
// Arcana V2 — Vietnamese phrasebook
//
// Renders the SAME language-neutral ReadingPlan as the English phrasebook, in
// natural Vietnamese. Builders are keyed by plan semantics, so both locales
// always express one identical interpretation.
// ---------------------------------------------------------------------------

const elementName: Record<ArcanaElement, string> = {
  fire: 'lửa',
  water: 'nước',
  air: 'khí',
  earth: 'đất',
  spirit: 'tinh thần',
};

const elementEssence: Record<ArcanaElement, string> = {
  fire: 'động lực, tia lửa và ý chí',
  water: 'cảm xúc, sự kết nối và trái tim',
  air: 'tư duy, sự sáng rõ và lời nói thật',
  earth: 'điều thực tế, vật chất và thân thể',
  spirit: 'bài học sâu hơn bên dưới',
};

/** Concrete noun a blocked new beginning would take, per element. */
const elementNoun: Record<ArcanaElement, string> = {
  fire: 'tia lửa',
  water: 'cảm xúc',
  air: 'lời nói thật',
  earth: 'bước đi thực tế',
  spirit: 'thay đổi',
};

/** What an element tends to demand of a feeling before allowing it. */
const elementDemand: Record<ArcanaElement, string> = {
  fire: 'hành động ngay',
  water: 'kìm giữ',
  air: 'giải thích',
  earth: 'quản lý',
  spirit: 'biện minh',
};

const suitName: Record<ArcanaMinorSuit, string> = {
  wands: 'Gậy',
  cups: 'Cốc',
  swords: 'Kiếm',
  pentacles: 'Tiền',
};

const motionPhrase: Record<ArcanaMotion, string> = {
  begin: 'điều vừa bắt đầu',
  grow: 'điều đang tụ đà',
  pause: 'điều đang dừng lại',
  release: 'điều sẵn sàng được đặt xuống',
  complete: 'điều đang khép trọn',
};

const topicDomain: Record<ArcanaTopic, string> = {
  work: 'công việc',
  love: 'chuyện tình cảm của bạn',
  study: 'việc học của bạn',
  finance: 'tài chính của bạn',
  self: 'mối quan hệ với bản thân',
  life: 'đời sống hằng ngày',
};

const topicNoun: Record<ArcanaTopic, string> = {
  work: 'công việc',
  love: 'tình cảm',
  study: 'học tập',
  finance: 'tài chính',
  self: 'cá nhân',
  life: 'hằng ngày',
};

const numberWord = ['', 'Át', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười'];

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}`;
}

function claimIndex(claim: ArcanaPositionClaim): number {
  return claim.position === 'foundation' ? 0 : claim.position === 'hinge' ? 1 : 2;
}

function claimKeywords(claim: ArcanaPositionClaim, ctx: ArcanaPhraseContext): string[] {
  const card = ctx.cards[claimIndex(claim)];
  const pool = claim.keywordSource === 'reversed' ? card.semantics.shadows : card.semantics.themes;
  return claim.keywordIndexes.map((index) => pool[index]).filter((word): word is string => Boolean(word));
}

// ---------------------------------------------------------------------------
// Tổng quan — mỗi chiến lược một khung riêng
// ---------------------------------------------------------------------------

interface OverviewSlots {
  q: string;
  domain: string;
  names: string;
  majors: number;
  element: string;
  essence: string;
}

function overviewArcSentence(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const shadow = ctx.cards[1].semantics.shadows[0] ?? ctx.cards[1].semantics.reversedTheme;
  switch (plan.arc.direction) {
    case 'rising':
      return `Hướng đi đang lên: điều bắt đầu quanh ${shadow} đã đang tìm không khí.`;
    case 'falling':
      return `Hướng đi đòi sự cẩn trọng: ${shadow} tích thêm sức nặng khi trải bài tiến về phía trước.`;
    case 'steady-dark':
      return `Tông trầm kéo dài suốt ba lá — ${shadow} nuôi vòng lặp cho tới khi được gọi tên.`;
    case 'steady-bright':
      return 'Tông sáng giữ đều cả ba lá — việc của bạn là giữ gìn, không phải thử thách.';
    case 'mixed':
      return `Các tông lẫn nhau, nên bản lề — ${shadow} — quyết định trải bài nghiêng về phía nào.`;
  }
}

function buildOverview(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const cards = ctx.cards;
  const names = joinNames(cards.map((card) => card.name));
  const dominance = plan.evidence.find((signal) => signal.kind === 'element-dominance');
  const slots: OverviewSlots = {
    q: ctx.question.text.vi,
    domain: topicDomain[ctx.topic],
    names,
    majors: plan.evidence.find((signal) => signal.kind === 'major-dominance')?.detail.count ?? 2,
    element: dominance?.detail.element ? elementName[dominance.detail.element] : 'tinh thần',
    essence: dominance?.detail.element ? elementEssence[dominance.detail.element] : '',
  };
  const s = slots;
  const roll = ctx.rng();
  const arc = overviewArcSentence(plan, ctx);

  const base = (() => { switch (plan.strategy) {
    case 'major-turning-point':
      return pickPhrase([
        `Với ${s.majors} lá Ẩn Chính trong ba lá, "${s.q}" không phải tâm trạng thoáng qua — ${s.names} vẽ ra một bước ngoặt thật trong ${s.domain}.`,
        `Bộ bài trả lời "${s.q}" bằng những nguyên mẫu: ${s.names}. Đây đọc như một chương cấu trúc của ${s.domain}, không phải thời tiết nền.`,
      ], roll);
    case 'inner-block':
      return pickPhrase([
        `Hai trong ba lá xuất hiện ngược, nên "${s.q}" ít nói về điều còn thiếu mà nhiều về điều đang có nhưng bị giữ lại. ${s.names} vẽ ra chính xác nơi dòng chảy đang khựng.`,
        `${s.names} trả lời "${s.q}" từ trong ra ngoài: năng lượng cho ${s.domain} vẫn có, nhưng nó đang di chuyển dưới bề mặt trước khi ra ngoài ánh sáng.`,
      ], roll);
    case 'tension-and-resolution':
      return pickPhrase([
        `${s.names} giữ một ma sát thật quanh "${s.q}" — và cả lối thoát. Trải bài không bắt bạn chọn phe; nó chỉ cách hai phía có thể cùng vận hành.`,
        `Với "${s.q}", ${s.names} mô tả một nút thắt trong ${s.domain} đang dần nới lỏng, nếu được xử lý đúng thứ tự.`,
      ], roll);
    case 'recovery':
      return pickPhrase([
        `Đọc theo thứ tự, ${s.names} đi từ sức nặng tới không khí: "${s.q}" bắt đầu ở nơi khó và kết thúc ở nơi dễ thở hơn.`,
        `Cung của ${s.names} đi lên. Với "${s.q}", nền móng thì nặng nhưng điều đang mở ra nhẹ thật — việc của bạn là không bỏ qua phần giữa.`,
      ], roll);
    case 'escalation':
      return pickPhrase([
        `${s.names} đi xuống về trọng lượng: điều ban đầu còn xoay xở được trong "${s.q}" đòi thêm sự chăm sóc ở mỗi bước. Đây là lời nhắc về nhịp độ, không phải hoảng loạn.`,
        `Với "${s.q}", ${s.names} cho thấy áp lực đang tích tụ trong ${s.domain}. Sự thành thật của trải bài chính là điểm cốt lõi: nhìn sớm, khi nó còn định hình được.`,
      ], roll);
    case 'release':
      return pickPhrase([
        `${s.names} liên tục vòng lại một cử chỉ cho "${s.q}": đặt một thứ xuống. Trải bài xem việc buông là một hành động, không phải tâm trạng.`,
        `Quanh "${s.q}", ${s.names} đồng thuận một điều — ${s.domain} chỉ nhẹ đi khi một thứ gì đó được phép kết thúc.`,
      ], roll);
    case 'stagnation':
      return pickPhrase([
        `${s.names} mô tả một vòng lặp quanh "${s.q}": cùng một lo lắng nuôi cùng một phản ứng. Gọi tên vòng lặp là vết nứt đầu tiên của nó.`,
        `Với "${s.q}", ${s.names} cho thấy ${s.domain} đang quay vòng thay vì tiến lên — không phải vì không thể đổi, mà vì mô thức đang tự nuôi chính nó.`,
      ], roll);
    case 'new-beginning':
      return pickPhrase([
        `${s.names} mang một năng lượng ngày-đầu rõ ràng vào "${s.q}": một điều gì đó trong ${s.domain} đang ở khởi đầu, và khởi đầu cần sự quan tâm hơn là sức ép.`,
        `Với "${s.q}", trải bài mở một cánh cửa thay vì một phán quyết: ${s.names} phác hình dáng sớm nhất của điều mới.`,
      ], roll);
    case 'court-dynamics':
      return pickPhrase([
        `${s.names} giống những con người hay tư thế hơn là sự kiện — "${s.q}" là chuyện bạn, và có thể cả người khác, đang xuất hiện thế nào trong ${s.domain}.`,
        `Với nhiều lá triều thần trên bàn, "${s.q}" trở thành câu hỏi về vai trò: ${s.names} hỏi ai đang làm gì trong ${s.domain}.`,
      ], roll);
    case 'elemental-dominance':
      return pickPhrase([
        `${s.names} chủ yếu nói một ngôn ngữ — ${s.element} — nên "${s.q}" tập trung vào một gian của ${s.domain}: ${s.essence}.`,
        `Trải bài trả lời "${s.q}" qua ${s.element} nhiều hơn một lần: ${s.names} liên tục quay về ${s.essence}.`,
      ], roll);
    case 'balanced-spread':
      return pickPhrase([
        `${s.names} tiếp cận "${s.q}" từ ba góc khác nhau — nền, bản lề và điều mở ra — mà không ép một kết luận duy nhất.`,
        `Với "${s.q}", ${s.names} tạo ra một trải bài cân bằng: ba dòng chảy riêng trong ${s.domain}, và sợi chỉ giữa chúng là của bạn để vẽ.`,
      ], roll);
  } })();

  return `${base} ${arc}`;
}


// ---------------------------------------------------------------------------
// Phần đọc từng lá theo vị trí
// ---------------------------------------------------------------------------

function positionFrame(claim: ArcanaPositionClaim, name: string, kw: string, kw2: string, roll: number): string {
  const reversed = claim.reversed;
  const relief = reversed && claim.tone >= 1; // Năm ngược, Mặt Trăng ngược, Ác Quỷ ngược...

  if (claim.position === 'foundation') {
    if (relief) {
      return pickPhrase([
        `${name} ngược nằm ở lớp nền như một sự căng đang dần dịu — ${kw} là mặt đất đang tự hồi phục.`,
        `Ở lớp sâu nhất, ${name} ngược đánh dấu một sức nặng đang được nhấc lên: ${kw} tạo nên nền móng cho tất cả.`,
      ], roll);
    }
    if (reversed) {
      return pickPhrase([
        `${name} ngược tạo nên lớp nền của trải bài: ${kw} — một nền móng đang mỏi, đang khép kín, hoặc đang vận hành từ bên dưới.`,
        `Bên dưới tất cả, ${name} ngược chỉ về ${kw}: chính mặt đất đang đòi được nhìn lại trước khi xây tiếp.`,
      ], roll);
    }
    if (claim.tone <= -1) {
      return pickPhrase([
        `${name} nằm ở lớp nền với một sức nặng thật — ${kw} nhuộm màu mọi thứ được xây phía trên.`,
        `Nền của trải bài là ${name}: ${kw}, một mặt đất không dễ nhưng thành thật.`,
      ], roll);
    }
    return pickPhrase([
      `${name} nằm ở lớp nền như ${motionPhrase[claim.motion]} — ${kw}${kw2 ? ` và ${kw2}` : ''} định hình mọi thứ được xây phía trên.`,
      `Cả trải bài lớn lên từ ${name}: ${kw} ở lớp móng, đủ vững để dựng lên.`,
      `Nốt trầm của trải bài là ${name} — ${kw} như lớp đất mà phần còn lại được trồng lên.`,
    ], roll);
  }

  if (claim.position === 'hinge') {
    if (relief) {
      return pickPhrase([
        `Ở bản lề, ${name} ngược cho thấy một nút thắt đang được gỡ: ${kw}, đang nới lỏng ngay trước mắt bạn.`,
        `${name} ngược là điều cần thấy rõ — không phải mối đe, mà là ${kw} cuối cùng cũng bắt đầu nhượng.`,
      ], roll);
    }
    if (reversed) {
      return pickPhrase([
        `${name} ngược đánh dấu điểm mù của trải bài: ${kw} đang vận hành dù có được gọi tên hay không.`,
        `Bản lề xoay quanh ${name} ngược — ${kw} đang lặng lẽ tác động, dễ bị bỏ lỡ nhất và quan trọng nhất cần thấy.`,
      ], roll);
    }
    return pickPhrase([
      `${name} là bản lề: ${kw} là điều cần được nhìn thẳng ngay lúc này.`,
      `Mọi thứ xoay quanh ${name} — ${kw}, nằm ngay trung tâm, không thể đi vòng.`,
      `Ở trung tâm, ${name} giơ ${kw} lên như một ngọn đèn: đây là phần mà cả trải bài liên tục chỉ vào.`,
    ], roll);
  }

  // opening — điều đang mở ra
  if (relief) {
    return pickPhrase([
      `${name} ngược mở đường bằng cách để một điều gì đó rút bớt — ${kw} đến như một sự nhẹ nhõm, không ồn ào.`,
      `Phía trước, ${name} ngược dọn ra một cánh cửa: ${kw}, kiểu mở ra lặng lẽ như một hơi thở dài.`,
    ], roll);
  }
  if (reversed) {
    return pickPhrase([
      `${name} ngược đứng ở điểm mở ra: ${kw} thực sự tồn tại, nhưng đang chậm lại, đang ở bên trong, hoặc chưa đủ an toàn để hành động.`,
      `Điều đang mở ra là ${name} ngược — ${kw} vốn đã có sẵn, chỉ là chưa sẵn sàng bị ép ra ngoài.`,
    ], roll);
  }
  return pickPhrase([
    `${name} mở ra đường đi phía trước: ${kw} là điều sẽ khả dụng khi bạn bước tiếp.`,
    `Lối ra của trải bài đi qua ${name} — ${kw}, đang chờ ở cánh cửa đã hé mở.`,
    `Phía trước, ${name} mang đến ${kw}: hình dáng mà câu chuyện muốn lớn thành tiếp theo.`,
  ], roll);
}


function toneSentence(claim: ArcanaPositionClaim, roll: number): string {
  if (claim.tone >= 2) {
    return pickPhrase([
      'Lá này mang đà thật — một trong những lá mạnh của trải bài.',
      'Có sẵn sức mạnh ở đây, chỉ cần dùng chứ không cần kiếm.',
    ], roll);
  }
  if (claim.tone === 1) {
    return pickPhrase([
      'Sắc thái của nó là xây dựng — hỗ trợ lặng lẽ chứ không kịch tính.',
      'Nó nghiêng về phía giúp đỡ, đòi sự tham gia hơn là sự phòng thủ.',
    ], roll);
  }
  if (claim.tone === 0) {
    return pickPhrase([
      'Đây là mặt đất trung lập; quan trọng là bạn đối diện nó thế nào.',
      'Không thuận gió cũng không ngược gió — nó cho thấy địa hình, không phải thời tiết.',
    ], roll);
  }
  if (claim.tone === -1) {
    return pickPhrase([
      'Nó đòi kiên nhẫn hơn là nỗ lực.',
      'Đây là điểm mềm — đáng được đến gần chậm rãi thay vì giải quyết nhanh.',
    ], roll);
  }
  return pickPhrase([
    'Nó gọi tên một sức nặng thật; giả vờ khác đi chỉ khiến nó nặng hơn.',
    'Đây là lá nặng nhất của trải bài, và xứng đáng được xem nghiêm túc thay vì tô vẽ.',
  ], roll);
}

function roleSentence(claim: ArcanaPositionClaim, name: string, roll: number): string {
  if (claim.role) {
    const roleWord = {
      student: 'người vẫn đang học luật chơi',
      messenger: 'người mang chuyển động giữa các nơi',
      actor: 'người hiện thân trọn vẹn cho dòng chảy',
      master: 'người được kỳ vọng cầm lái',
    }[claim.role];
    return pickPhrase([
      `Là một lá triều thần, ${name} giống một tư thế ứng xử hơn là một sự kiện — ${roleWord}.`,
      `Bài triều thần nói về tư thế: ${name} là ${roleWord} trong nguyên tố ${elementName[claim.element]}.`,
    ], roll);
  }
  if (claim.group === 'major') {
    return pickPhrase([
      'Là một lá Ẩn Chính, nó nói về bức tranh lớn hơn là một tâm trạng thoáng qua.',
      'Sức nặng Ẩn Chính khiến điều này ít liên quan hoàn cảnh, mà gần với bài học bên dưới hơn.',
    ], roll);
  }
  if (claim.suit) {
    return pickPhrase([
      `Theo ngôn ngữ của bộ ${suitName[claim.suit]}, đây là ${motionPhrase[claim.motion]} quanh ${elementEssence[claim.element]}.`,
      `Trong bộ ${suitName[claim.suit]}, nó đánh dấu ${motionPhrase[claim.motion]} — bộ bài của ${elementEssence[claim.element]}.`,
    ], roll);
  }
  return '';
}

function buildPosition(claim: ArcanaPositionClaim, ctx: ArcanaPhraseContext): string {
  const card = ctx.cards[claimIndex(claim)];
  const [kw, kw2] = claimKeywords(claim, ctx);
  const sentences = [
    positionFrame(claim, card.name, kw ?? card.semantics.uprightTheme, kw2 ?? '', ctx.rng()),
  ];
  if (claim.group === 'major' && card.meaning) {
    // Ẩn Chính có văn bản riêng trong danh mục; dùng lại thay vì diễn giải.
    sentences.push(card.meaning);
  } else {
    sentences.push(toneSentence(claim, ctx.rng()));
  }
  const role = roleSentence(claim, card.name, ctx.rng());
  if (role) sentences.push(role);
  return sentences.join(' ');
}

// ---------------------------------------------------------------------------
// Ảnh hưởng lá kề — lá bên cạnh uốn lá này thế nào
// ---------------------------------------------------------------------------

function buildAdjacentNote(plan: ArcanaReadingPlan, index: number, ctx: ArcanaPhraseContext): string {
  const rel = plan.relationshipClaim;
  if ((rel.kind !== 'element-support' && rel.kind !== 'element-tension') || (rel.a !== index && rel.b !== index)) {
    return '';
  }
  const otherIndex = rel.a === index ? rel.b : rel.a;
  const other = ctx.cards[otherIndex];
  const mine = ctx.cards[index];
  const myElement = elementName[mine.semantics.element];
  const otherElement = elementName[other.semantics.element];

  if (rel.kind === 'element-tension') {
    return pickPhrase([
      `Vì ${other.name} đối đáp lại bằng ${otherElement}, hai lá cọ vào nhau — lá này khó mà an vị.`,
      `Nguyên tố ${otherElement} của ${other.name} cọ xát với ${myElement} này, nên thông điệp của nó đến kèm ma sát.`,
    ], ctx.rng());
  }
  return pickPhrase([
    `Nguyên tố ${otherElement} của ${other.name} nuôi ${myElement} này, nên nó đáp xuống với sức mạnh hơn bình thường.`,
    `Nó không hành động một mình: ${other.name} tiếp cho nó ${otherElement}, giúp ${myElement} ở đây vững hơn.`,
  ], ctx.rng());
}


// ---------------------------------------------------------------------------
// Mối liên kết — trích dẫn đúng một tín hiệu đã phát hiện
// ---------------------------------------------------------------------------

function themeOf(ctx: ArcanaPhraseContext, index: number): string {
  const sem = ctx.cards[index].semantics;
  return sem.reversed ? sem.reversedTheme : sem.uprightTheme;
}

type ConnectionBuilder = (
  rel: ArcanaRelationshipClaim,
  ctx: ArcanaPhraseContext,
  roll: number,
) => string;

const connectionBuilders: Partial<Record<ArcanaRelationshipClaim['kind'], ConnectionBuilder>> = {
  'element-support': (rel, ctx, roll) => {
    if (rel.kind !== 'element-support') return '';
    const a = ctx.cards[rel.a];
    const b = ctx.cards[rel.b];
    const [ea, eb] = rel.elements.map((e) => elementName[e]);
    return pickPhrase([
      `${a.name} và ${b.name} đang hợp tác: ${ea} và ${eb} là hai dòng thân thiện, nên ${themeOf(ctx, rel.a)} có chỗ để trở thành ${themeOf(ctx, rel.b)}.`,
      `Hãy nhìn cách ${a.name} nghiêng về ${b.name}: ${ea} đi cùng ${eb} là một cặp nâng nhau — bên này định hướng, bên kia giữ được.`,
    ], roll);
  },
  'element-tension': (rel, ctx, roll) => {
    if (rel.kind !== 'element-tension') return '';
    const a = ctx.cards[rel.a];
    const b = ctx.cards[rel.b];
    const [ea, eb] = rel.elements.map((e) => elementName[e]);
    return pickPhrase([
      `Nút thắt thành thật của trải bài nằm giữa ${a.name} và ${b.name}: ${ea} và ${eb} kéo về hai hướng — ${themeOf(ctx, rel.a)} đối lập ${themeOf(ctx, rel.b)} — và giả vờ không thấy sẽ làm phẳng mất ý nghĩa.`,
      `${a.name} và ${b.name} không tự nhiên đồng ý nhau: ${ea} gặp ${eb} thành ma sát. Sự căng giữa ${themeOf(ctx, rel.a)} và ${themeOf(ctx, rel.b)} mới là chủ đề thật của trải bài.`,
    ], roll);
  },
  'suit-repeat': (rel, ctx, roll) => {
    if (rel.kind !== 'suit-repeat') return '';
    const [firstPos, secondPos] = rel.positions;
    const essence = elementEssence[ctx.cards[firstPos].semantics.element];
    return pickPhrase([
      `Với ${rel.positions.length} lá thuộc bộ ${suitName[rel.suit]}, trải bài liên tục quay về một chất — ${essence}. ${ctx.cards[firstPos].name} và ${ctx.cards[secondPos].name} là hai khoảnh khắc của cùng một cuộc trò chuyện.`,
      `${ctx.cards[firstPos].name} và ${ctx.cards[secondPos].name} cùng thuộc bộ ${suitName[rel.suit]}: một nguyên tố lên tiếng ở hai điểm của cung, khiến ${essence} trở thành tiếng mẹ đẻ của trải bài.`,
    ], roll);
  },
  'element-dominance': (rel, _ctx, roll) => {
    if (rel.kind !== 'element-dominance') return '';
    return pickPhrase([
      `${elementName[rel.element]} chiếm ưu thế trong trải bài này (${rel.count}/3), nên toàn bộ câu hỏi nghiêng về ${elementEssence[rel.element]}; điều còn thiếu sẽ được xử lý sau, không phải trước.`,
      `Hãy đếm nguyên tố: ${rel.count} trong ba lá nói tiếng ${elementName[rel.element]}. Quanh ${elementEssence[rel.element]}, trải bài này tập trung — mạnh ở chỗ nó mạnh, mỏng ở chỗ khác.`,
    ], roll);
  },
  'reversal-concentration': (rel, ctx, roll) => {
    if (rel.kind !== 'reversal-concentration') return '';
    const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
    return pickPhrase([
      `${rel.count} trong ba lá xuất hiện ngược, nên năng lượng ở đây là thật nhưng đang nội tâm hóa: ${names} làm việc dưới bề mặt trước khi ra ngoài được.`,
      `Chiều ngược chính là thông điệp: ${names} gợi rằng dòng chảy đang di chuyển kín đáo, cần được gỡ tắc chứ không bị ép.`,
    ], roll);
  },
  'major-dominance': (rel, ctx, roll) => {
    if (rel.kind !== 'major-dominance') return '';
    const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
    return pickPhrase([
      `${rel.count} lá Ẩn Chính trong một trải bài là bộ bài đang nói bằng chữ in hoa: ${names} mô tả một chương cấu trúc, không phải tâm trạng thoáng qua.`,
      `Với ${rel.count} nguyên mẫu trên bàn — ${names} — hãy xem điều chúng gọi tên như một cung dài mà các lựa chọn hằng ngày đang phục vụ.`,
    ], roll);
  },
};


connectionBuilders['tone-arc'] = (rel, ctx, roll) => {
  if (rel.kind !== 'tone-arc') return '';
  const [f, h, o] = ctx.cards;
  if (rel.direction === 'rising') {
    return pickPhrase([
      `Cung đi lên: ${f.name} đặt một nền nặng hơn nơi ${o.name} khép lại. Chuyển động từ ${themeOf(ctx, 0)} tới ${themeOf(ctx, 2)} là tin tốt của trải bài — được trả giá, không miễn phí.`,
      `Từ ${f.name} đến ${o.name}, sức nặng nhẹ dần. ${h.name} ở giữa chính là nơi khúc quanh thực sự xảy ra; bỏ qua nó là cung gãy.`,
    ], roll);
  }
  if (rel.direction === 'falling') {
    return pickPhrase([
      `Cung đi xuống: ${f.name} giữ điều sáng hơn những gì ${o.name} nhận lấy. Đây không phải điềm xấu — mà là lời mời đối diện đầu nặng sớm, khi nó còn định hình được.`,
      `Giữa ${f.name} và ${o.name}, trải bài nặng dần. ${h.name} cho thấy áp lực tụ lại đầu tiên ở đâu, và sự chăm sóc nên đặt ở đó.`,
    ], roll);
  }
  if (rel.direction === 'steady-dark') {
    return pickPhrase([
      `Cả ba lá cùng nằm ở một quãng trầm: ${f.name}, ${h.name} và ${o.name} tạo thành vòng lặp chứ không phải thang — cùng một lo lắng nuôi cùng một phản ứng.`,
      `${f.name}, ${h.name} và ${o.name} chia sẻ một tông nặng. Trải bài không dự đoán; nó phản chiếu một chu kỳ sẽ lặp lại cho tới khi được gọi tên.`,
    ], roll);
  }
  return pickPhrase([
    `${f.name}, ${h.name} và ${o.name} cùng nằm trong một quãng sáng — một trải bài ổn định hiếm có. Rủi ro không nằm ở khó khăn mà ở việc xem sự dễ dãi là hiển nhiên.`,
    `Cung bằng phẳng và sáng từ ${f.name} tới ${o.name}: thấy gì được nấy, nên việc cần làm là giữ gìn, không phải giải cứu.`,
  ], roll);
};

connectionBuilders['number-echo'] = (rel, ctx, roll) => {
  if (rel.kind !== 'number-echo') return '';
  const [firstPos, secondPos] = rel.positions;
  return pickPhrase([
    `Hai lá ${numberWord[rel.number]} trong một trải bài: cùng một bài học ở hai độ sâu. ${ctx.cards[firstPos].name} và ${ctx.cards[secondPos].name} mời bạn để ý điều đang lặp lại.`,
    `${ctx.cards[firstPos].name} và ${ctx.cards[secondPos].name} cùng mang con số ${numberWord[rel.number]} — một tiếng vang nói rằng chủ đề này chưa xong với bạn.`,
  ], roll);
};

connectionBuilders['number-sequence'] = (rel, ctx, roll) => {
  if (rel.kind !== 'number-sequence') return '';
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    rel.direction === 'rising'
      ? `${f.name}, ${h.name} và ${o.name} tăng dần về số — mỗi lá xây trên lá trước. Trải bài đọc như các bậc của một cầu thang.`
      : `${f.name}, ${h.name} và ${o.name} giảm dần về số — mỗi lá buông một lớp. Trải bài đọc như một cuộc hạ có chủ đích.`,
    rel.direction === 'rising'
      ? `Các con số tăng từ ${f.name} tới ${o.name}: đà đang cộng dồn, và bậc giữa không thể nhảy qua.`
      : `Các con số giảm từ ${f.name} tới ${o.name}: một thứ gì đó đang được chưng cất về phần cốt lõi.`,
  ], roll);
};

connectionBuilders['court-dynamics'] = (rel, ctx, roll) => {
  if (rel.kind !== 'court-dynamics') return '';
  const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
  return pickPhrase([
    `Trải bài này có người, không trừu tượng: ${names} đi qua nó. Hãy đọc chúng như những tư thế bạn có thể mang — hoặc những người đã đứng quanh câu hỏi.`,
    `Với nhiều lá triều thần (${names}), câu hỏi trở nên mang tính quan hệ: ai đang gánh phần nào, và vai trò nào thực sự là của bạn?`,
  ], roll);
};

connectionBuilders['motion-shared'] = (rel, ctx, roll) => {
  if (rel.kind !== 'motion-shared') return '';
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    `${f.name}, ${h.name} và ${o.name} chia sẻ một nhịp: ${motionPhrase[rel.motion]}. Trải bài nhất trí về giai đoạn hiện tại.`,
    `Cả ba lá cùng chỉ một hướng — ${motionPhrase[rel.motion]}. Khi bộ bài đồng thuận thế này, chính giai đoạn là thông điệp.`,
  ], roll);
};

connectionBuilders['triad'] = (_rel, ctx, roll) => {
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    `${f.name}, ${h.name} và ${o.name} không hô to một thông điệp; chúng định vị nó từ ba phía. Hãy đọc như một trường: ${themeOf(ctx, 0)} ở nền, ${themeOf(ctx, 1)} ở bản lề, ${themeOf(ctx, 2)} ở cửa.`,
    `Không lá nào át lá nào: ${themeOf(ctx, 0)} (nền), ${themeOf(ctx, 1)} (bản lề) và ${themeOf(ctx, 2)} (mở ra) giữ sức nặng gần như ngang nhau.`,
  ], roll);
};

function buildConnection(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const rel = plan.relationshipClaim;
  const builder = connectionBuilders[rel.kind] ?? connectionBuilders['triad'];
  return builder ? builder(rel, ctx, ctx.rng()) : '';
}


// ---------------------------------------------------------------------------
// Lời nhắn cuối — câu hỏi cụ thể hoặc hành động nhỏ, rút ra từ plan
// ---------------------------------------------------------------------------

function buildReflection(claim: ArcanaReflectionClaim, ctx: ArcanaPhraseContext): string {
  const focus = ctx.cards[claim.focusIndex] ?? ctx.cards[2];
  const name = focus.name;
  const domain = topicDomain[claim.topic];
  const noun = claim.elementFocus ? elementNoun[claim.elementFocus] : 'bước đi';
  const foundationDemand = claim.foundationElement ? elementDemand[claim.foundationElement] : 'giải thích';
  const hingeDemand = claim.elementFocus ? elementDemand[ctx.cards[1].semantics.element] : 'quản lý';
  const shadow = claim.hingeShadow ?? ctx.cards[1].semantics.shadows[0] ?? 'điều nằm ở giữa';
  const roll = ctx.rng();

  switch (claim.kind) {
    case 'blocked-beginning':
      return pickPhrase([
        `${name} ngược chứ không vắng mặt — ${noun} vẫn ở đó, chỉ đang bị giữ lại. Hãy tự hỏi: ${noun} nào sẽ trở nên khả dĩ nếu nó không cần bị ${foundationDemand} hay ${hingeDemand} ngay lập tức?`,
        `Một ${name} ngược nói rằng điều mới tồn tại nhưng chưa cảm thấy an toàn. Tuần này, hãy để một ${noun} được riêng tư và chưa cần chứng minh — điều gì đổi khi nó không phải được ${foundationDemand} ngay?`,
      ], roll);
    case 'sustainable-step':
      return pickPhrase([
        `${name} cho thấy nơi nỗ lực đang loãng. Hãy hỏi: thói quen ${topicNoun[claim.topic]} nhỏ nào vẫn bền được trong một tuần khó khăn — và điều gì đang lặng lẽ phá nó?`,
        `Vì bản lề đang mang ${shadow}, những cử chỉ lớn sẽ không bền. Hãy chọn một thói quen ${topicNoun[claim.topic]} nhỏ đến mức sống sót qua tuần khó nhất, và để ${name} đánh dấu nơi nó bắt đầu.`,
        `Hãy chọn phiên bản nhỏ nhất của một thói quen ${topicNoun[claim.topic]} — đủ nhẹ để giữ được cả trong tuần khó nhất — và để ${name} đánh dấu rằng như thế là đủ.`,
      ], roll);
    case 'integration': {
      const first = claim.elementFocus ? elementName[claim.elementFocus] : 'dòng chảy này';
      const second = claim.foundationElement ? elementName[claim.foundationElement] : 'dòng kia';
      return pickPhrase([
        `${name} đứng ở điểm ma sát. Thử thế này: dành cho mỗi dòng chảy một giờ riêng trong tuần — một cho ${first}, một cho ${second} — và xem dòng nào mềm trước.`,
        `Hãy hỏi: ở đâu trong ${domain} mà ${first} và ${second} có thể thay phiên thay vì đánh nhau? ${name} gợi rằng câu trả lời là sắp xếp, không phải đầu hàng.`,
      ], roll);
    }
    case 'release':
      return pickPhrase([
        `${name} đánh dấu điều sẵn sàng được đặt xuống. Hãy viết ra một nghĩa vụ trong ${domain} mà bạn biết là đã xong, và quyết định xem "xong" trông như thế nào.`,
        `Hãy hỏi: nếu ${name} có thể mang giúp bạn một thứ trong tuần này, bạn sẽ đưa nó thứ gì đầu tiên — và điều gì đang giữ bạn lại?`,
      ], roll);
    case 'trust-the-turn':
      return pickPhrase([
        `${name} cho thấy cung đang nhẹ dần. Hãy hỏi: đâu là một cách nhỏ để hợp tác với hướng nhẹ hơn trong tuần này, thay vì thử xem nó có thật không?`,
        `Khúc quanh đã xảy ra; ${name} đánh dấu vị trí của nó. Hãy để một kế hoạch trong ${domain} đủ lỏng để được điều đang mở ra cải thiện.`,
      ], roll);
    case 'choice':
      return pickPhrase([
        `${name} mang đến một khởi đầu, không phải bảo chứng. Hãy hỏi: tuần này bạn sẽ chọn gì trong ${domain} nếu tin bước đầu hơn là tấm bản đồ đầy đủ?`,
        `Một khởi đầu cần một chiếc nôi. Hãy cho ${name} một cái: một cam kết nhỏ, có ngày, trong ${domain} — rồi xem nó làm gì.`,
      ], roll);
    case 'attention':
      return pickPhrase([
        `${name} giữ bản lề của trải bài. Hãy hỏi: ${shadow} đang bảo vệ bạn khỏi việc nhận ra điều gì — và bạn sẽ thấy gì nếu nhìn thẳng?`,
        `Ngồi với ${name} một phút lặng trước khi hành động. Lá bản lề thường gọi tên điều ta bỏ qua nhất.`,
      ], roll);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const arcanaPhrasebookVi: ArcanaPhrasebook = {
  overview: buildOverview,
  position: buildPosition,
  adjacentNote: buildAdjacentNote,
  connection: buildConnection,
  reflection: buildReflection,
  positionLabel: (index) => arcanaSpreadLabels.vi[(['past', 'present', 'future'] as const)[index] ?? 'present'],
  orientationWord: (reversed) => (reversed ? 'ngược' : 'xuôi'),
};
