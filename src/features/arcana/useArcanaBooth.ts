import { useCallback, useMemo, useState } from 'react';

import { getArcanaCardById, getArcanaCardDisplay } from './arcanaCards';
import { findCorpusReading } from './arcanaMessageEngine';
import {
  buildArcanaReading,
  serializeArcanaReading,
  validateReadingSpecificity,
} from './arcanaReadingEngine';
import { getArcanaQuestionById, getArcanaQuestionsByTopic } from './arcanaQuestions';
import { createSeed } from './arcanaRng';
import { readArcanaHistory, saveArcanaReading } from './arcanaStorage';
import { arcanaSpreadOrder, resolveArcanaDraw } from './arcanaSystems';
import { buildComboKey } from './hfTarotData';
import type {
  ArcanaLocale,
  ArcanaPackType,
  ArcanaReading,
  ArcanaSpreadCard,
  ArcanaTopic,
} from './types';

// One step per screen — the phased ritual flow.
export type ArcanaStage =
  | 'reward' // reward entry
  | 'topic' // choose topic
  | 'question' // choose question
  | 'pack' // choose pack
  | 'opening' // pack opening animation
  | 'reveal' // three-card spread reveal
  | 'reading'; // interpretation + save/close

export function useArcanaBooth(locale: ArcanaLocale) {
  const [stage, setStage] = useState<ArcanaStage>('reward');
  const [selectedTopic, setSelectedTopic] = useState<ArcanaTopic | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<ArcanaPackType>('arcana');
  const [currentReading, setCurrentReading] = useState<ArcanaReading | null>(null);
  const [history, setHistory] = useState<ArcanaReading[]>(readArcanaHistory);

  const topicQuestions = useMemo(
    () => (selectedTopic ? getArcanaQuestionsByTopic(selectedTopic) : []),
    [selectedTopic],
  );

  const beginRitual = useCallback(() => setStage('topic'), []);

  const chooseTopic = useCallback((topic: ArcanaTopic) => {
    setSelectedTopic(topic);
    setSelectedQuestionId(null);
    setCurrentReading(null);
    setStage('question');
  }, []);

  const chooseQuestion = useCallback((questionId: string) => {
    setSelectedQuestionId(questionId);
    setCurrentReading(null);
    setStage('pack');
  }, []);

  const choosePack = useCallback((pack: ArcanaPackType) => {
    setSelectedPack(pack);
  }, []);

  /** Build the spread, fetch the corpus interpretation, move into opening. */
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
        cardName: display?.name ?? roll.cardId,
        arcana: display?.arcana ?? '',
        atlas: card?.atlas ?? 'major',
        atlasIndex: card?.atlasIndex ?? 0,
        rarity: roll.rarity,
        finish: roll.finish,
        orientation: roll.orientation,
      };
    });

    const slugs = cards.map((card) => card.slug);
    const comboKey = buildComboKey(slugs);

    // Build a card- and question-specific reading immediately (template source).
    // The HF corpus only sets `source`/anchor, so visible text stays localized.
    const baseContent = buildArcanaReading(cards, question, question.topic, locale, seed, null);
    if (import.meta.env.DEV) {
      validateReadingSpecificity(baseContent, cards, question, locale);
    }

    const baseReading: ArcanaReading = {
      id: `arcana-${Date.now()}-${seed}`,
      questionId: question.id,
      questionText: question.text[locale],
      topic: question.topic,
      packType: selectedPack,
      cards,
      comboKey,
      messageSnapshot: serializeArcanaReading(baseContent, locale),
      locale,
      createdAt: new Date().toISOString(),
    };

    setCurrentReading(baseReading);
    setStage('opening');

    // Enrich with the HF corpus anchor signal once it lazily resolves.
    void findCorpusReading(slugs, seed).then((match) => {
      if (!match) return;
      const enriched = buildArcanaReading(cards, question, question.topic, locale, seed, match);
      setCurrentReading((prev) => {
        if (!prev || prev.id !== baseReading.id) return prev;
        return {
          ...prev,
          corpusReading: match.reading,
          messageSnapshot: serializeArcanaReading(enriched, locale),
        };
      });
    });
  }, [locale, selectedPack, selectedQuestionId]);

  /** Opening animation finished -> reveal the spread. */
  const completeReveal = useCallback(() => setStage('reveal'), []);

  /** Reveal acknowledged -> show the interpretation. */
  const showReading = useCallback(() => setStage('reading'), []);

  const drawAgain = useCallback(() => {
    setCurrentReading(null);
    setStage('pack');
  }, []);

  const saveCurrentReading = useCallback(() => {
    if (!currentReading) return;
    setHistory(saveArcanaReading(currentReading));
  }, [currentReading]);

  const refreshHistory = useCallback(() => {
    setHistory(readArcanaHistory());
  }, []);

  const resetFlow = useCallback(() => {
    setStage('reward');
    setSelectedTopic(null);
    setSelectedQuestionId(null);
    setCurrentReading(null);
  }, []);

  const goBack = useCallback(() => {
    setStage((prev) => {
      switch (prev) {
        case 'question':
          return 'topic';
        case 'pack':
          return 'question';
        default:
          return prev;
      }
    });
  }, []);

  const goToStage = useCallback((next: ArcanaStage) => setStage(next), []);

  return {
    stage,
    goToStage,
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
    completeReveal,
    showReading,
    drawAgain,
    saveCurrentReading,
    refreshHistory,
    resetFlow,
    setCurrentReading,
  };
}
