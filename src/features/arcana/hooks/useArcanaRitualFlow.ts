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
    const baseContent = buildArcanaReading(cards, question, question.topic, locale, seed, null);
    if (import.meta.env.DEV) {
      validateReadingSpecificity(baseContent, cards, question, locale);
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
      locale,
      createdAt: new Date().toISOString(),
    };

    setCurrentReading(baseReading);
    setStage('openingPack');

    void findCorpusReading(slugs, seed).then((match) => {
      if (!match) return;
      const enriched = buildArcanaReading(cards, question, question.topic, locale, seed, match);
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
    setHistory(saveArcanaReading(currentReading));
    setStage('saved');
  }, [currentReading]);

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
    currentReading,
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
