import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import ArcanaHistoryDialog from './ArcanaHistoryDialog';
import CardRevealStep from './components/CardRevealStep';
import EntryStep from './components/EntryStep';
import PackOpeningStep from './components/PackOpeningStep';
import PackSelectStep from './components/PackSelectStep';
import QuestionStep from './components/QuestionStep';
import ReadingStep from './components/ReadingStep';
import ArcanaRitualShell from './components/ArcanaRitualShell';
import TopicStep from './components/TopicStep';
import { useArcanaRitualFlow } from './hooks/useArcanaRitualFlow';
import { useI18n } from '../../i18n';

interface ArcanaBoothDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function ArcanaBoothDialog({ isOpen, onClose }: ArcanaBoothDialogProps) {
  const { language, t } = useI18n();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const ritual = useArcanaRitualFlow(language);
  const {
    stage,
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
    goToStage,
    goBack,
  } = ritual;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    refreshHistory();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, refreshHistory]);

  if (!isOpen) return null;

  const canGoBack = stage === 'choosingQuestion' || stage === 'choosingPack';

  const handleSave = () => {
    saveCurrentReading();
    toast.success(t('arcana.saved'), { theme: 'colored' });
  };

  const handleCloseAndReset = () => {
    resetFlow();
    onClose();
  };

  return (
    <>
      <ArcanaRitualShell
        stage={stage}
        canGoBack={canGoBack}
        hasHistory={history.length > 0}
        onBack={goBack}
        onClose={handleCloseAndReset}
        onOpenHistory={() => setIsHistoryOpen(true)}
      >
        {stage === 'idle' && (
          <EntryStep packType={selectedPack} onBegin={beginRitual} />
        )}

        {stage === 'choosingTopic' && (
          <TopicStep
            locale={language}
            selectedTopic={selectedTopic}
            onSelect={chooseTopic}
          />
        )}

        {stage === 'choosingQuestion' && selectedTopic && (
          <QuestionStep
            locale={language}
            topic={selectedTopic}
            questions={topicQuestions}
            selectedQuestionId={selectedQuestionId}
            onSelect={chooseQuestion}
          />
        )}

        {stage === 'choosingPack' && (
          <PackSelectStep
            locale={language}
            selectedPack={selectedPack}
            onSelect={choosePack}
            onOpenPack={openPack}
          />
        )}

        {stage === 'openingPack' && currentReading && (
          <PackOpeningStep
            packType={currentReading.packType}
            onComplete={completePackOpening}
          />
        )}

        {stage === 'revealingCards' && currentReading && (
          <CardRevealStep
            key={currentReading.id}
            locale={language}
            reading={currentReading}
            onRead={showReading}
          />
        )}

        {(stage === 'reading' || stage === 'saved') && currentReading && (
          <ReadingStep
            locale={language}
            reading={currentReading}
            isSaved={stage === 'saved'}
            hasHistory={history.length > 0}
            onSave={handleSave}
            onDrawAgain={drawAgain}
            onClose={handleCloseAndReset}
            onOpenHistory={() => setIsHistoryOpen(true)}
          />
        )}
      </ArcanaRitualShell>

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

export default ArcanaBoothDialog;
