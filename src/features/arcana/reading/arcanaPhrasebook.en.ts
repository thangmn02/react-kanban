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
// Arcana V2 — English phrasebook
//
// Renders the language-neutral ReadingPlan into English prose. Variants within
// one builder are semantically equivalent; the *choice of builder* is driven
// by the plan (strategy, claim kind, tone, orientation) — never by chance.
// ---------------------------------------------------------------------------

const elementName: Record<ArcanaElement, string> = {
  fire: 'fire',
  water: 'water',
  air: 'air',
  earth: 'earth',
  spirit: 'spirit',
};

const elementEssence: Record<ArcanaElement, string> = {
  fire: 'drive, spark and will',
  water: 'feeling, connection and the heart',
  air: 'thought, clarity and honest words',
  earth: 'the practical, material and bodily',
  spirit: 'the deeper lesson underneath',
};

/** Concrete noun a blocked new beginning would take, per element. */
const elementNoun: Record<ArcanaElement, string> = {
  fire: 'spark',
  water: 'feeling',
  air: 'honest word',
  earth: 'practical step',
  spirit: 'change',
};

/** What an element tends to demand of a feeling before allowing it. */
const elementDemand: Record<ArcanaElement, string> = {
  fire: 'acted on',
  water: 'contained',
  air: 'explained',
  earth: 'managed',
  spirit: 'justified',
};

const suitName: Record<ArcanaMinorSuit, string> = {
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

const motionPhrase: Record<ArcanaMotion, string> = {
  begin: 'something just beginning',
  grow: 'something gathering momentum',
  pause: 'something holding still',
  release: 'something ready to be set down',
  complete: 'something coming full circle',
};

const topicDomain: Record<ArcanaTopic, string> = {
  work: 'work',
  love: 'your love life',
  study: 'your studies',
  finance: 'your finances',
  self: 'your relationship with yourself',
  life: 'daily life',
};

const topicNoun: Record<ArcanaTopic, string> = {
  work: 'work',
  love: 'relationship',
  study: 'study',
  finance: 'financial',
  self: 'personal',
  life: 'daily',
};

const numberWord = [
  '',
  'Ace',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
];

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
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
// Overview — one builder per narrative strategy
// ---------------------------------------------------------------------------

interface OverviewSlots {
  q: string;
  domain: string;
  names: string;
  theme: string;
  majors: number;
  element: string;
  essence: string;
}

function overviewArcSentence(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const shadow = ctx.cards[1].semantics.shadows[0] ?? ctx.cards[1].semantics.reversedTheme;
  switch (plan.arc.direction) {
    case 'rising':
      return `The direction is upward: what begins around ${shadow} is already looking for air.`;
    case 'falling':
      return `The direction asks for care: ${shadow} collects weight as the spread moves forward.`;
    case 'steady-dark':
      return `The register stays low throughout — ${shadow} keeps the loop fed until it is named.`;
    case 'steady-bright':
      return 'The register stays clear across all three cards — the task is to steward it, not to test it.';
    case 'mixed':
      return `The tones are mixed, so the hinge — ${shadow} — decides which way the spread tips.`;
  }
}

function buildOverview(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const cards = ctx.cards;
  const names = joinNames(cards.map((card) => card.name));
  const thesis = cards[plan.reflectionPrompt.focusIndex] ?? cards[2];
  const themePool = plan.centralThemeSource === 'reversed' ? thesis.semantics.shadows : thesis.semantics.themes;
  const dominance = plan.evidence.find((signal) => signal.kind === 'element-dominance');
  const slots: OverviewSlots = {
    q: ctx.question.text.en,
    domain: topicDomain[ctx.topic],
    names,
    theme: themePool[plan.centralThemeKeywordIndex] ?? thesis.semantics.uprightTheme,
    majors: plan.evidence.find((signal) => signal.kind === 'major-dominance')?.detail.count ?? 2,
    element: dominance?.detail.element ? elementName[dominance.detail.element] : 'spirit',
    essence: dominance?.detail.element ? elementEssence[dominance.detail.element] : '',
  };
  const s = slots;
  const roll = ctx.rng();
  const arc = overviewArcSentence(plan, ctx);

  const base = (() => { switch (plan.strategy) {
    case 'major-turning-point':
      return pickPhrase([
        `With ${s.majors} Major Arcana in three cards, "${s.q}" is not a passing mood — ${s.names} frame a genuine turning point in ${s.domain}.`,
        `The deck answers "${s.q}" in archetypes: ${s.names}. This reads as a structural chapter of ${s.domain}, not background weather.`,
      ], roll);
    case 'inner-block':
      return pickPhrase([
        `Two of the three cards arrive reversed, so "${s.q}" is less about what is missing and more about what is present but held back. ${s.names} map exactly where the current stalls.`,
        `${s.names} answer "${s.q}" from the inside out: the energy for ${s.domain} exists, but it is moving under the surface before it can move in the open.`,
      ], roll);
    case 'tension-and-resolution':
      return pickPhrase([
        `${s.names} hold a real friction around "${s.q}" — and a way through it. The spread does not ask you to pick a side; it shows how the two could work.`,
        `For "${s.q}", ${s.names} describe a knot in ${s.domain} that is already loosening, provided it is handled in the right order.`,
      ], roll);
    case 'recovery':
      return pickPhrase([
        `Read in order, ${s.names} move from weight toward air: "${s.q}" begins somewhere hard and ends somewhere more breathable.`,
        `The arc of ${s.names} rises. For "${s.q}", the foundation is heavy but what is opening is genuinely lighter — the work is not skipping the middle.`,
      ], roll);
    case 'escalation':
      return pickPhrase([
        `${s.names} descend in weight: what starts manageable in "${s.q}" asks for more care at each step. This is a reading about pacing, not panic.`,
        `For "${s.q}", ${s.names} show pressure collecting across ${s.domain}. The spread's honesty is the point: see it early, while it is still shapeable.`,
      ], roll);
    case 'release':
      return pickPhrase([
        `${s.names} keep circling one gesture for "${s.q}": setting something down. The spread treats release as an action, not a mood.`,
        `Around "${s.q}", ${s.names} agree on one thing — ${s.domain} lightens only when something is allowed to end.`,
      ], roll);
    case 'stagnation':
      return pickPhrase([
        `${s.names} describe a loop around "${s.q}": the same concern feeding the same response. Naming the loop is the first crack in it.`,
        `For "${s.q}", ${s.names} show ${s.domain} circling rather than moving — not because nothing can change, but because the pattern is currently self-feeding.`,
      ], roll);
    case 'new-beginning':
      return pickPhrase([
        `${s.names} carry a clear first-day energy into "${s.q}": something in ${s.domain} is at its beginning, and beginnings answer to attention rather than force.`,
        `For "${s.q}", the spread opens a door rather than a verdict: ${s.names} sketch the earliest shape of something new.`,
      ], roll);
    case 'court-dynamics':
      return pickPhrase([
        `${s.names} read more like people or postures than events — "${s.q}" is about how you, and perhaps others, show up in ${s.domain}.`,
        `With several court figures on the table, "${s.q}" becomes a question of roles: ${s.names} ask who is doing what in ${s.domain}.`,
      ], roll);
    case 'elemental-dominance':
      return pickPhrase([
        `${s.names} speak mostly one language — ${s.element} — so "${s.q}" concentrates in one chamber of ${s.domain}: ${s.essence}.`,
        `The spread answers "${s.q}" through ${s.element} more than once: ${s.names} keep returning to ${s.essence}.`,
      ], roll);
    case 'balanced-spread':
      return pickPhrase([
        `${s.names} take up "${s.q}" from three different angles — foundation, hinge, and opening — without forcing a single verdict.`,
        `For "${s.q}", ${s.names} offer a balanced spread: three distinct currents in ${s.domain}, and the thread between them is yours to draw.`,
      ], roll);
  } })();

  return `${base} ${arc}`;
}


// ---------------------------------------------------------------------------
// Per-card position sections
// ---------------------------------------------------------------------------

function positionFrame(claim: ArcanaPositionClaim, name: string, kw: string, kw2: string, roll: number): string {
  const reversed = claim.reversed;
  const relief = reversed && claim.tone >= 1; // reversed Five / Moon / Devil etc.

  if (claim.position === 'foundation') {
    if (relief) {
      return pickPhrase([
        `${name} reversed sits at the foundation as a strain that is already easing — ${kw} is the ground recovering itself.`,
        `Underneath it all, ${name} reversed marks a weight in the middle of lifting: ${kw} forms the base everything else stands on.`,
      ], roll);
    }
    if (reversed) {
      return pickPhrase([
        `${name} reversed forms the base of this reading: ${kw} — a foundation that is strained, withheld, or working from underneath.`,
        `Beneath everything, ${name} reversed points to ${kw}: the ground itself is asking for attention before anything can build on it.`,
      ], roll);
    }
    if (claim.tone <= -1) {
      return pickPhrase([
        `${name} sits at the foundation carrying real weight — ${kw} colors everything built on top of it.`,
        `The base of this spread is ${name}: ${kw} — not easy ground, but honest ground.`,
      ], roll);
    }
    return pickPhrase([
      `${name} sits at the foundation as ${motionPhrase[claim.motion]} — ${kw}${kw2 ? ` and ${kw2}` : ''} shape everything built on top.`,
      `Everything in this spread grows out of ${name}: ${kw} at the base, steady enough to build on.`,
      `The ground note is ${name} — ${kw} as the soil the rest of the reading is planted in.`,
    ], roll);
  }

  if (claim.position === 'hinge') {
    if (relief) {
      return pickPhrase([
        `At the hinge, ${name} reversed shows a knot mid-untying: ${kw}, loosening as you watch it.`,
        `${name} reversed is what most needs seeing — not a threat, but ${kw} finally starting to give.`,
      ], roll);
    }
    if (reversed) {
      return pickPhrase([
        `${name} reversed marks the blind spot of this spread: ${kw} is at work whether or not it gets named.`,
        `The hinge turns on ${name} reversed — ${kw} operating quietly, easiest to miss and most important to see.`,
      ], roll);
    }
    return pickPhrase([
      `${name} is the hinge: ${kw} is what most needs to be seen clearly right now.`,
      `Everything pivots on ${name} — ${kw}, sitting at the center where it cannot be walked around.`,
      `At the center, ${name} holds up ${kw} like a lamp: this is the part the rest of the spread keeps pointing at.`,
    ], roll);
  }

  // opening
  if (relief) {
    return pickPhrase([
      `${name} reversed opens the way by letting something drain out of it — ${kw} arriving as relief rather than fanfare.`,
      `Ahead, ${name} reversed clears a door: ${kw}, the quiet kind of opening that feels like an exhale.`,
    ], roll);
  }
  if (reversed) {
    return pickPhrase([
      `${name} reversed stands at the opening: ${kw} is genuinely present, but delayed, internal, or not yet safe to act on.`,
      `What is opening is ${name} reversed — ${kw} that exists already, though it is not ready to be forced into the open.`,
    ], roll);
  }
  return pickPhrase([
    `${name} opens the way forward: ${kw} is what becomes available as you move.`,
    `The road out of this spread runs through ${name} — ${kw}, waiting at the door that is already ajar.`,
    `Ahead, ${name} offers ${kw}: the shape the story wants to grow into next.`,
  ], roll);
}


function toneSentence(claim: ArcanaPositionClaim, roll: number): string {
  if (claim.tone >= 2) {
    return pickPhrase([
      'It carries real momentum — this is one of the strong cards of the spread.',
      'There is strength available here, ready to be used rather than earned first.',
    ], roll);
  }
  if (claim.tone === 1) {
    return pickPhrase([
      'Its register is constructive — quiet support rather than drama.',
      'It leans helpful, asking for participation more than protection.',
    ], roll);
  }
  if (claim.tone === 0) {
    return pickPhrase([
      'It is neutral ground; what matters is how you meet it.',
      'Neither tailwind nor headwind — it shows the terrain, not the weather.',
    ], roll);
  }
  if (claim.tone === -1) {
    return pickPhrase([
      'It asks for patience more than effort.',
      'It is a tender spot — worth approaching slowly rather than solving quickly.',
    ], roll);
  }
  return pickPhrase([
    'It names real weight; pretending otherwise would only make it heavier.',
    'This is the heavy card of the spread, and it deserves to be taken seriously rather than decorated.',
  ], roll);
}

function roleSentence(claim: ArcanaPositionClaim, name: string, roll: number): string {
  if (claim.role) {
    const roleWord = {
      student: 'the one still learning the rules',
      messenger: 'the one carrying movement between places',
      actor: 'the one embodying the current fully',
      master: 'the one expected to steer it',
    }[claim.role];
    return pickPhrase([
      `As a court figure, ${name} reads less like an event and more like a way of showing up — ${roleWord}.`,
      `Court cards describe postures: ${name} is ${roleWord} in the element of ${elementName[claim.element]}.`,
    ], roll);
  }
  if (claim.group === 'major') {
    return pickPhrase([
      'As a Major Arcana card, it speaks to the larger pattern rather than a passing mood.',
      'Its Major weight makes this less about circumstance and more about the lesson underneath it.',
    ], roll);
  }
  if (claim.suit) {
    return pickPhrase([
      `In the language of ${suitName[claim.suit]}, this is ${motionPhrase[claim.motion]} around ${elementEssence[claim.element]}.`,
      `Within ${suitName[claim.suit]}, it marks ${motionPhrase[claim.motion]} — the suit of ${elementEssence[claim.element]}.`,
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
    // Majors carry unique hand-written prose in the catalog; reuse it rather
    // than paraphrasing. (Minor meanings are formulaic and stay out.)
    sentences.push(card.meaning);
  } else {
    sentences.push(toneSentence(claim, ctx.rng()));
  }
  const role = roleSentence(claim, card.name, ctx.rng());
  if (role) sentences.push(role);
  return sentences.join(' ');
}

// ---------------------------------------------------------------------------
// Adjacent influence — how a neighboring card bends this one
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
      `Because ${other.name} answers it with ${otherElement}, the two rub against each other — this card cannot fully settle.`,
      `The ${otherElement} of ${other.name} pushes against this ${myElement}, so its message arrives with friction attached.`,
    ], ctx.rng());
  }
  return pickPhrase([
    `The ${otherElement} of ${other.name} feeds this ${myElement}, so it lands with more strength than it would alone.`,
    `It is not acting alone: ${other.name} lends it ${otherElement}, which steadies the ${myElement} here.`,
  ], ctx.rng());
}


// ---------------------------------------------------------------------------
// Connection — cites exactly one detected spread signal
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
      `${a.name} and ${b.name} cooperate: ${ea} and ${eb} are friendly currents, so ${themeOf(ctx, rel.a)} has somewhere real to become ${themeOf(ctx, rel.b)}.`,
      `Watch how ${a.name} leans toward ${b.name}: ${ea} with ${eb} is a supported pairing — what one side intends, the other can actually hold.`,
    ], roll);
  },
  'element-tension': (rel, ctx, roll) => {
    if (rel.kind !== 'element-tension') return '';
    const a = ctx.cards[rel.a];
    const b = ctx.cards[rel.b];
    const [ea, eb] = rel.elements.map((e) => elementName[e]);
    return pickPhrase([
      `The honest knot of this spread sits between ${a.name} and ${b.name}: ${ea} and ${eb} pull in different directions — ${themeOf(ctx, rel.a)} against ${themeOf(ctx, rel.b)} — and pretending otherwise would flatten the reading.`,
      `${a.name} and ${b.name} do not naturally agree: ${ea} meets ${eb} as friction. The tension between ${themeOf(ctx, rel.a)} and ${themeOf(ctx, rel.b)} is the reading's real subject.`,
    ], roll);
  },
  'suit-repeat': (rel, ctx, roll) => {
    if (rel.kind !== 'suit-repeat') return '';
    const [firstPos, secondPos] = rel.positions;
    const essence = elementEssence[ctx.cards[firstPos].semantics.element];
    return pickPhrase([
      `With ${rel.positions.length} cards in ${suitName[rel.suit]}, this spread keeps returning to one suit — ${essence}. ${ctx.cards[firstPos].name} and ${ctx.cards[secondPos].name} are two moments of the same conversation.`,
      `${ctx.cards[firstPos].name} and ${ctx.cards[secondPos].name} share ${suitName[rel.suit]}: one element speaking at two points of the arc, which makes ${essence} the spread's native tongue.`,
    ], roll);
  },
  'element-dominance': (rel, _ctx, roll) => {
    if (rel.kind !== 'element-dominance') return '';
    return pickPhrase([
      `${elementName[rel.element]} dominates this spread (${rel.count} of 3), so the whole question tilts toward ${elementEssence[rel.element]}; whatever is missing gets handled last, not first.`,
      `Count the elements: ${rel.count} of the three cards speak ${elementName[rel.element]}. Around ${elementEssence[rel.element]}, this spread is concentrated — strong where it is strong, thin elsewhere.`,
    ], roll);
  },
  'reversal-concentration': (rel, ctx, roll) => {
    if (rel.kind !== 'reversal-concentration') return '';
    const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
    return pickPhrase([
      `${rel.count} of the three cards arrive reversed, so the energy here is real but internalized: ${names} work below the surface before they can work in the open.`,
      `The reversals are the message: ${names} suggest the current is moving under wraps, asking to be unblocked rather than forced.`,
    ], roll);
  },
  'major-dominance': (rel, ctx, roll) => {
    if (rel.kind !== 'major-dominance') return '';
    const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
    return pickPhrase([
      `${rel.count} Major Arcana in one spread is the deck speaking in capitals: ${names} describe a structural chapter, not a passing mood.`,
      `With ${rel.count} archetypes on the table — ${names} — treat what they name as a longer arc that daily choices are serving.`,
    ], roll);
  },
};


connectionBuilders['tone-arc'] = (rel, ctx, roll) => {
  if (rel.kind !== 'tone-arc') return '';
  const [f, h, o] = ctx.cards;
  if (rel.direction === 'rising') {
    return pickPhrase([
      `The arc lifts: ${f.name} sets a heavier base than ${o.name} closes on. The movement from ${themeOf(ctx, 0)} toward ${themeOf(ctx, 2)} is the reading's good news — earned, not free.`,
      `From ${f.name} to ${o.name} the weight lightens. ${h.name} in the middle is where the turn actually happens; skip it and the arc breaks.`,
    ], roll);
  }
  if (rel.direction === 'falling') {
    return pickPhrase([
      `The arc descends: ${f.name} holds something brighter than ${o.name} receives. This is not doom — it is a request to meet the heavier end early, while it is still shapeable.`,
      `Between ${f.name} and ${o.name} the reading gains weight. ${h.name} shows where the pressure collects first, and where care lands best.`,
    ], roll);
  }
  if (rel.direction === 'steady-dark') {
    return pickPhrase([
      `All three cards sit in a low register: ${f.name}, ${h.name} and ${o.name} form a loop rather than a ladder — the same concern feeding the same response.`,
      `${f.name}, ${h.name} and ${o.name} share one heavy key. The spread is not predicting; it is mirroring a cycle that repeats until it is named.`,
    ], roll);
  }
  return pickPhrase([
    `${f.name}, ${h.name} and ${o.name} sit in the same clear register — a rare steady spread. The risk is not difficulty but taking the ease for granted.`,
    `The arc is level and bright from ${f.name} to ${o.name}: what you see is what you get, so the work is stewardship, not rescue.`,
  ], roll);
};

connectionBuilders['number-echo'] = (rel, ctx, roll) => {
  if (rel.kind !== 'number-echo') return '';
  const [firstPos, secondPos] = rel.positions;
  return pickPhrase([
    `Two ${numberWord[rel.number]}s in one spread: the same lesson at two depths. ${ctx.cards[firstPos].name} and ${ctx.cards[secondPos].name} ask you to notice what repeats.`,
    `${ctx.cards[firstPos].name} and ${ctx.cards[secondPos].name} both carry the number ${numberWord[rel.number]} — an echo that says this theme is not finished with you yet.`,
  ], roll);
};

connectionBuilders['number-sequence'] = (rel, ctx, roll) => {
  if (rel.kind !== 'number-sequence') return '';
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    rel.direction === 'rising'
      ? `${f.name}, ${h.name} and ${o.name} climb in number — each card building on the last. The spread reads like steps of one staircase.`
      : `${f.name}, ${h.name} and ${o.name} step down in number — each card releasing one layer. The spread reads like a deliberate descent.`,
    rel.direction === 'rising'
      ? `The numbers rise from ${f.name} to ${o.name}: momentum is compounding, and the middle step cannot be skipped.`
      : `The numbers fall from ${f.name} to ${o.name}: something is being distilled down to what is essential.`,
  ], roll);
};

connectionBuilders['court-dynamics'] = (rel, ctx, roll) => {
  if (rel.kind !== 'court-dynamics') return '';
  const names = joinNames(rel.positions.map((i) => ctx.cards[i].name));
  return pickPhrase([
    `This spread is populated, not abstract: ${names} walk through it. Read them as postures you could take — or people already standing around the question.`,
    `With several court figures present (${names}), the question becomes relational: who is carrying which part of this, and which role is actually yours?`,
  ], roll);
};

connectionBuilders['motion-shared'] = (rel, ctx, roll) => {
  if (rel.kind !== 'motion-shared') return '';
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    `${f.name}, ${h.name} and ${o.name} share one motion: ${motionPhrase[rel.motion]}. The spread is unanimous about the phase this is in.`,
    `All three cards point the same way — ${motionPhrase[rel.motion]}. When the deck agrees like this, the phase itself is the message.`,
  ], roll);
};

connectionBuilders['triad'] = (_rel, ctx, roll) => {
  const [f, h, o] = ctx.cards;
  return pickPhrase([
    `${f.name}, ${h.name} and ${o.name} do not shout one message; they triangulate it. Read them as one field: ${themeOf(ctx, 0)} at the base, ${themeOf(ctx, 1)} at the turn, ${themeOf(ctx, 2)} at the door.`,
    `No single card here outvotes the others: ${themeOf(ctx, 0)} (foundation), ${themeOf(ctx, 1)} (hinge) and ${themeOf(ctx, 2)} (opening) hold roughly equal weight.`,
  ], roll);
};

function buildConnection(plan: ArcanaReadingPlan, ctx: ArcanaPhraseContext): string {
  const rel = plan.relationshipClaim;
  const builder = connectionBuilders[rel.kind] ?? connectionBuilders['triad'];
  return builder ? builder(rel, ctx, ctx.rng()) : '';
}


// ---------------------------------------------------------------------------
// Reflection — specific question or tiny action, derived from the plan
// ---------------------------------------------------------------------------

function buildReflection(claim: ArcanaReflectionClaim, ctx: ArcanaPhraseContext): string {
  const focus = ctx.cards[claim.focusIndex] ?? ctx.cards[2];
  const name = focus.name;
  const domain = topicDomain[claim.topic];
  const noun = claim.elementFocus ? elementNoun[claim.elementFocus] : 'step';
  const foundationDemand = claim.foundationElement ? elementDemand[claim.foundationElement] : 'explained';
  const hingeDemand = claim.elementFocus ? elementDemand[ctx.cards[1].semantics.element] : 'managed';
  const shadow = claim.hingeShadow ?? ctx.cards[1].semantics.shadows[0] ?? 'what sits in the middle';
  const roll = ctx.rng();

  switch (claim.kind) {
    case 'blocked-beginning':
      return pickPhrase([
        `${name} is reversed, not absent — the ${noun} is there, held back. Ask yourself: what ${noun} would become possible if it did not need to be ${foundationDemand} or ${hingeDemand} right away?`,
        `A reversed ${name} says the new thing exists but does not feel safe yet. This week, let one ${noun} stay private and unproven — what changes when it does not have to be ${foundationDemand} immediately?`,
      ], roll);
    case 'sustainable-step':
      return pickPhrase([
        `${name} shows where the effort thins. Ask: which small ${topicNoun[claim.topic]} routine would still be sustainable during a difficult week — and what would quietly break it?`,
        `Because the hinge carries ${shadow}, grand gestures will not hold. Choose one ${topicNoun[claim.topic]} habit small enough to survive your hardest week, and let ${name} mark where it starts.`,
        `Pick the smallest honest version of a ${topicNoun[claim.topic]} habit — light enough to keep even on your hardest week — and let ${name} mark that as enough for now.`,
      ], roll);
    case 'integration': {
      const first = claim.elementFocus ? elementName[claim.elementFocus] : 'one current';
      const second = claim.foundationElement ? elementName[claim.foundationElement] : 'the other';
      return pickPhrase([
        `${name} sits at the friction point. Try this: give each current its own hour this week — one for ${first}, one for ${second} — and notice which one softens first.`,
        `Ask: where in ${domain} could ${first} and ${second} take turns instead of fighting? ${name} suggests the answer is scheduling, not surrender.`,
      ], roll);
    }
    case 'release':
      return pickPhrase([
        `${name} marks what is ready to be set down. Write down the one obligation in ${domain} you secretly know is finished, and decide what "done" would look like.`,
        `Ask: if ${name} could take one thing off your hands this week, what would you hand it first — and what keeps you from handing it over?`,
      ], roll);
    case 'trust-the-turn':
      return pickPhrase([
        `${name} shows the arc already lifting. Ask: what is one small way to cooperate with the lighter direction this week, instead of testing whether it is real?`,
        `The turn is already happening; ${name} marks where. Let one plan in ${domain} stay loose enough to be improved by what is opening.`,
      ], roll);
    case 'choice':
      return pickPhrase([
        `${name} offers a beginning, not a guarantee. Ask: what would you choose in ${domain} this week if you trusted the first step more than the full map?`,
        `A beginning asks for a container. Give ${name} one: a single, dated, small commitment in ${domain} — then watch what it does.`,
      ], roll);
    case 'attention':
      return pickPhrase([
        `${name} holds the hinge of this spread. Ask: what is ${shadow} protecting you from noticing — and what would you see if you looked directly?`,
        `Sit with ${name} for one quiet minute before acting on any of this. The hinge card usually names the thing we most skip.`,
      ], roll);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const arcanaPhrasebookEn: ArcanaPhrasebook = {
  overview: buildOverview,
  position: buildPosition,
  adjacentNote: buildAdjacentNote,
  connection: buildConnection,
  reflection: buildReflection,
  positionLabel: (index) => arcanaSpreadLabels.en[(['past', 'present', 'future'] as const)[index] ?? 'present'],
  orientationWord: (reversed) => (reversed ? 'reversed' : 'upright'),
};
