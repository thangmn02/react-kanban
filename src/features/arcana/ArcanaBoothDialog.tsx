import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import ArcanaHistoryDialog from './ArcanaHistoryDialog';
import ArcanaPackOpening from './ArcanaPackOpening';
import ArcanaPackPicker from './ArcanaPackPicker';
import ArcanaQuestionPicker from './ArcanaQuestionPicker';
import ArcanaReadingResult from './ArcanaReadingResult';
import ArcanaSpread from './ArcanaSpread';
import ArcanaTopicPicker from './ArcanaTopicPicker';
import { getArcanaPackSprite } from './arcanaAtlas';
import { arcanaTopicLabels } from './arcanaQuestions';
import { arcanaPackAtlasIndex } from './arcanaSystems';
import { useArcanaBooth, type ArcanaStage } from './useArcanaBooth';
import { useI18n } from '../../i18n';

interface ArcanaBoothDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const numberedSteps: ArcanaStage[] = ['topic', 'question', 'pack', 'reveal', 'reading'];
const roman = ['I', 'II', 'III', 'IV', 'V'];

function ArcanaBoothDialog({ isOpen, onClose }: ArcanaBoothDialogProps) {
  const { language, t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const booth = useArcanaBooth(language);
  const {
    stage, goBack, selectedTopic, selectedQuestionId, selectedPack, topicQuestions,
    currentReading, history, beginRitual, chooseTopic, chooseQuestion, choosePack,
    openPack, completeReveal, showReading, drawAgain, saveCurrentReading,
    refreshHistory, resetFlow, setCurrentReading, goToStage,
  } = booth;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    refreshHistory();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, refreshHistory]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveCurrentReading();
    toast.success(t('arcana.saved'), { theme: 'colored' });
  };

  const stepIndex = numberedSteps.indexOf(stage);
  const canGoBack = stage === 'question' || stage === 'pack';

  const sceneMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-stretch justify-center overflow-y-auto">
        {/* Void backdrop + starfield */}
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="arcana-void fixed inset-0 cursor-default"
        />
        <div className="arcana-stars fixed inset-0 overflow-hidden" aria-hidden="true" />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcana-booth-title"
          className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-6 text-[#e8dcc4] sm:px-8"
        >
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={t('arcana.back')}
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#d6b87a]/35 text-[#d6b87a] transition hover:border-[#d6b87a]/70 hover:bg-[#d6b87a]/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25"
                >
                  ←
                </button>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[#d6b87a]/70">Arcana</p>
                <h2 id="arcana-booth-title" className="arcana-display text-2xl font-semibold text-[#f3e7cc] sm:text-3xl">
                  {t('arcana.booth')}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="cursor-pointer rounded-full border border-[#d6b87a]/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e8dcc4] transition hover:border-[#d6b87a]/60 hover:bg-[#d6b87a]/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25"
              >
                {t('arcana.history')}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/15 text-[#e8dcc4]/80 transition hover:border-white/35 hover:bg-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/15"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Constellation step indicator */}
          {stepIndex >= 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              {numberedSteps.map((step, index) => {
                const done = index < stepIndex;
                const active = index === stepIndex;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <span
                      className={`arcana-display grid h-8 w-8 place-items-center rounded-full border text-[11px] transition ${
                        active
                          ? 'border-[#d6b87a] text-[#f3e7cc] shadow-[0_0_18px_rgba(214,184,122,0.5)]'
                          : done
                            ? 'border-[#d6b87a]/50 text-[#d6b87a]/80'
                            : 'border-white/15 text-white/35'
                      }`}
                    >
                      {roman[index]}
                    </span>
                    {index < numberedSteps.length - 1 && (
                      <span className={`h-px w-6 ${index < stepIndex ? 'bg-[#d6b87a]/60' : 'bg-white/15'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="arcana-rule mt-6" aria-hidden="true" />

          {/* Stage scenes */}
          <div className="relative mt-8 flex flex-1 items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div key={stage} className="w-full" {...sceneMotion}>
                {stage === 'reward' && (
                  <Scene>
                    <div className="arcana-dais relative mx-auto mb-8 grid place-items-center pt-6">
                      <span
                        className={`arcana-art h-60 w-44 rounded-2xl border-2 border-[#d6b87a]/40 shadow-[0_30px_90px_rgba(0,0,0,0.7)] ${shouldReduceMotion ? '' : 'arcana-float'}`}
                        style={getArcanaPackSprite(arcanaPackAtlasIndex[selectedPack])}
                        aria-hidden="true"
                      />
                    </div>
                    <SceneTitle eyebrow={t('arcana.disclaimer')} title={t('arcana.rewardEntryTitle')} hint={t('arcana.rewardEntryBody')} />
                    <PrimaryAction onClick={beginRitual}>{t('arcana.beginRitual')}</PrimaryAction>
                    <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-[#d6b87a]/55">{t('arcana.earnMore')}</p>
                  </Scene>
                )}

                {stage === 'topic' && (
                  <Scene>
                    <SceneTitle title={t('arcana.chooseTopic')} hint={t('arcana.chooseTopicHint')} />
                    <ArcanaTopicPicker selectedTopic={selectedTopic} onSelect={chooseTopic} />
                  </Scene>
                )}

                {stage === 'question' && selectedTopic && (
                  <Scene>
                    <SceneTitle
                      eyebrow={arcanaTopicLabels[language][selectedTopic]}
                      title={t('arcana.chooseQuestion')}
                    />
                    <div className="mx-auto max-h-[22rem] max-w-xl overflow-y-auto pr-1">
                      <ArcanaQuestionPicker
                        questions={topicQuestions}
                        selectedQuestionId={selectedQuestionId}
                        onSelect={chooseQuestion}
                      />
                    </div>
                  </Scene>
                )}

                {stage === 'pack' && (
                  <Scene>
                    <SceneTitle title={t('arcana.choosePack')} hint={t('arcana.choosePackHint')} />
                    <div className="mx-auto max-w-xl">
                      <ArcanaPackPicker selectedPack={selectedPack} onSelect={choosePack} />
                      <PrimaryAction className="mt-7" onClick={openPack}>{t('arcana.openPack')}</PrimaryAction>
                    </div>
                  </Scene>
                )}

                {stage === 'opening' && currentReading && (
                  <ArcanaPackOpening packType={currentReading.packType} onComplete={completeReveal} />
                )}

                {stage === 'reveal' && currentReading && (
                  <Scene>
                    <SceneTitle title={t('arcana.revealTitle')} hint={t('arcana.revealHint')} />
                    <ArcanaSpread cards={currentReading.cards} isRevealed />
                    <PrimaryAction className="mt-8" onClick={showReading}>{t('arcana.readInterpretation')}</PrimaryAction>
                  </Scene>
                )}

                {stage === 'reading' && (
                  <ArcanaReadingResult
                    reading={currentReading}
                    onDrawAgain={drawAgain}
                    onSave={handleSave}
                    onClose={() => {
                      resetFlow();
                      onClose();
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>

      <ArcanaHistoryDialog
        isOpen={isHistoryOpen}
        readings={history}
        onClose={() => setIsHistoryOpen(false)}
        onOpenReading={(reading) => {
          setCurrentReading(reading);
          goToStage('reading');
          setIsHistoryOpen(false);
        }}
      />
    </>
  );
}

function Scene({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full">{children}</div>;
}

function SceneTitle({ eyebrow, title, hint }: { eyebrow?: string; title: string; hint?: string }) {
  return (
    <div className="mb-7 text-center">
      {eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b87a]/70">{eyebrow}</p>}
      <h3 className="arcana-display text-2xl font-semibold text-[#f3e7cc] sm:text-[1.75rem]">{title}</h3>
      {hint && <p className="arcana-serif mx-auto mt-2 max-w-md text-base italic text-[#e8dcc4]/70">{hint}</p>}
    </div>
  );
}

function PrimaryAction({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`arcana-btn-gold mx-auto block cursor-pointer rounded-full px-9 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/35 ${className}`}
    >
      {children}
    </button>
  );
}

export default ArcanaBoothDialog;
