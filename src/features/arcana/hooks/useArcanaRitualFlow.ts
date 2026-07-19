import { useCallback, useMemo, useState } from 'react';

import { getArcanaCardById, getArcanaCardDisplay } from '../arcanaCards';
import { getArcanaCardImagePath } from '../arcanaAtlas';
import { findCorpusReading } from '../arcanaMessageEngine';
import {
  buildArcanaReading,
  serializeArcanaReading,
  validateReadingSpecificity,
} from '../arcanaReadingEngine';
import { getArcanaQuestionById, getArcanaQuestionsByTopic } from '../arcanaQuestions';
import {
  arcanaReadingEngineVersionV2,
  buildArcanaReadingV2,
} from '../reading/arcanaReadingComposerV2';
import { logArcanaEngineComparison } from '../reading/arcanaReadingCompare';
import { createSeed } from '../arcanaRng';
import { readArcanaHistory, saveArcanaReading } from '../arcanaStorage';
import { arcanaSpreadOrder, resolveArcanaDraw } from '../arcanaSystems';
import { buildComboKey } from '../hfTarotData';
import type {
  ArcanaLocale,
  ArcanaPackType,
  ArcanaReading,
  ArcanaSpreadCard,
  ArcanaTopic,
} from '../types';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';

export type ArcanaRitualStage =
  | 'idle'
  | 'choosingTopic'
  | 'choosingQuestion'
  | 'choosingPack'
  | 'openingPack'
  | 'revealingCards'
  | 'reading'
  | 'saved';

export function localizeArcanaReading(reading: ArcanaReading, locale: ArcanaLocale): ArcanaReading {
  const question = getArcanaQuestionById(reading.questionId);
  const cards: ArcanaSpreadCard[] = reading.cards.map((spreadCard) => {
    const card = getArcanaCardById(spreadCard.cardId);
    const display = card ? getArcanaCardDisplay(card, locale, spreadCard.orientation) : null;

    return {
      ...spreadCard,
      slug: card?.slug ?? spreadCard.slug,
      cardName: normalizeVietnameseText(display?.name ?? spreadCard.cardName),
      imagePath: getArcanaCardImagePath(card?.atlas ?? spreadCard.atlas),
      arcana: normalizeVietnameseText(display?.arcana ?? spreadCard.arcana),
      atlas: card?.atlas ?? spreadCard.atlas,
      atlasIndex: card?.atlasIndex ?? spreadCard.atlasIndex,
    };
  });

  if (!question) {
    return { ...reading, cards, locale };
  }

  // Engine versioning: V1 history records keep rendering with the V1 engine
  // (their stored snapshot stays byte-identical in meaning); only readings
  // stamped as V2 regenerate through the semantic engine.
  const content = reading.readingEngineVersion === arcanaReadingEngineVersionV2
    ? buildArcanaReadingV2(cards, question, question.topic, locale, reading.id, null)
    : buildArcanaReading(cards, question, question.topic, locale, reading.id, null);

  return {
    ...reading,
    questionText: normalizeVietnameseText(question.text[locale]),
    topic: question.topic,
    cards,
    messageSnapshot: normalizeVietnameseText(serializeArcanaReading(content, locale)),
    locale,
  };
}

export function useArcanaRitualFlow(locale: ArcanaLocale) {
  const [stage, setStage] = useState<ArcanaRitualStage>('idle');
  const [selectedTopic, setSelectedTopic] = useState<ArcanaTopic | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<ArcanaPackType>('arcana');
  const [currentReading, setCurrentReading] = useState<ArcanaReading | null>(null);
  const [history, setHistory] = useState<ArcanaReading[]>(readArcanaHistory);

  const topicQuestions = useMemo(
    () => (selectedTopic ? getArcanaQuestionsByTopic(selectedTopic) : []),
    [selectedTopic],
  );

  const localizedCurrentReading = useMemo(
    () => (currentReading ? localizeArcanaReading(currentReading, locale) : null),
    [currentReading, locale],
  );

  const beginRitual = useCallback(() => setStage('choosingTopic'), []);

  const chooseTopic = useCallback((topic: ArcanaTopic) => {
    setSelectedTopic(topic);
    setSelectedQuestionId(null);
    setCurrentReading(null);
    setStage('choosingQuestion');
  }, []);

  const chooseQuestion = useCallback((questionId: string) => {
    setSelectedQuestionId(questionId);
    setCurrentReading(null);
    setStage('choosingPack');
  }, []);

  const choosePack = useCallback((pack: ArcanaPackType) => {
    setSelectedPack(pack);
  }, []);

  const openPack = useCallback(() => {
    const question = selectedQuestionId ? getArcanaQuestionById(selectedQuestionId) : null;
    if (!question) return;

    const seed = createSeed();
    const draw = resolveArcanaDraw(selectedPack, seed);

    const cards: ArcanaSpreadCard[] = draw.rolls.map((roll, i) => {
      const card = getArcanaCardById(roll.cardId);
      const display = card ? getArcanaCardDisplay(card, locale, roll.orientation) : null;
      return {
        position: arcanaSpreadOrder[i] ?? 'present',
        cardId: roll.cardId,
        slug: card?.slug ?? roll.cardId,
        cardName: normalizeVietnameseText(display?.name ?? roll.cardId),
        imagePath: getArcanaCardImagePath(card?.atlas ?? 'major'),
        arcana: normalizeVietnameseText(display?.arcana ?? ''),
        atlas: card?.atlas ?? 'major',
        atlasIndex: card?.atlasIndex ?? 0,
        rarity: roll.rarity,
        finish: roll.finish,
        orientation: roll.orientation,
      };
    });

    const slugs = cards.map((card) => card.slug);
    const comboKey = buildComboKey(slugs);
    // New readings are composed by the V2 semantic engine (spread-aware).
    const baseContent = buildArcanaReadingV2(cards, question, question.topic, locale, seed, null);
    if (import.meta.env.DEV) {
      validateReadingSpecificity(baseContent, cards, question, locale);
      logArcanaEngineComparison(cards, question, question.topic, locale, seed, null);
    }

    const baseReading: ArcanaReading = {
      id: `arcana-${Date.now()}-${seed}`,
      questionId: question.id,
      questionText: normalizeVietnameseText(question.text[locale]),
      topic: question.topic,
      packType: selectedPack,
      cards,
      comboKey,
      messageSnapshot: normalizeVietnameseText(serializeArcanaReading(baseContent, locale)),
      readingEngineVersion: arcanaReadingEngineVersionV2,
      locale,
      createdAt: new Date().toISOString(),
    };

    setCurrentReading(baseReading);
    setStage('openingPack');

    void findCorpusReading(slugs, seed).then((match) => {
      if (!match) return;
      const enriched = buildArcanaReadingV2(cards, question, question.topic, locale, seed, match);
      setCurrentReading((prev) => {
        if (!prev || prev.id !== baseReading.id) return prev;
        return {
          ...prev,
          corpusReading: match.reading,
          messageSnapshot: normalizeVietnameseText(serializeArcanaReading(enriched, locale)),
        };
      });
    });
  }, [locale, selectedPack, selectedQuestionId]);

  const completePackOpening = useCallback(() => setStage('revealingCards'), []);
  const showReading = useCallback(() => setStage('reading'), []);

  const drawAgain = useCallback(() => {
    setCurrentReading(null);
    setStage('choosingPack');
  }, []);

  const saveCurrentReading = useCallback(() => {
    if (!currentReading) return;
    setHistory(saveArcanaReading(localizeArcanaReading(currentReading, locale)));
    setStage('saved');
  }, [currentReading, locale]);

  const refreshHistory = useCallback(() => {
    setHistory(readArcanaHistory());
  }, []);

  const resetFlow = useCallback(() => {
    setStage('idle');
    setSelectedTopic(null);
    setSelectedQuestionId(null);
    setCurrentReading(null);
  }, []);

  const goBack = useCallback(() => {
    setStage((prev) => {
      switch (prev) {
        case 'choosingQuestion':
          return 'choosingTopic';
        case 'choosingPack':
          return 'choosingQuestion';
        default:
          return prev;
      }
    });
  }, []);

  return {
    stage,
    goToStage: setStage,
    goBack,
    selectedTopic,
    selectedQuestionId,
    selectedPack,
    topicQuestions,
    currentReading: localizedCurrentReading,
    history,
    beginRitual,
    chooseTopic,
    chooseQuestion,
    choosePack,
    openPack,
    completePackOpening,
    showReading,
    drawAgain,
    saveCurrentReading,
    refreshHistory,
    resetFlow,
    setCurrentReading,
  };
}
