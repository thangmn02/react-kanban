import { useReducedMotion } from 'framer-motion';

import type { ArcanaRitualStage } from '../hooks/useArcanaRitualFlow';
import { useI18n } from '../../../i18n';

interface ArcanaRitualShellProps {
  stage: ArcanaRitualStage;
  canGoBack: boolean;
  hasHistory: boolean;
  onBack: () => void;
  onClose: () => void;
  onOpenHistory: () => void;
  children: React.ReactNode;
}

const stageOrder: ArcanaRitualStage[] = [
  'idle',
  'choosingTopic',
  'choosingQuestion',
  'choosingPack',
  'openingPack',
  'revealingCards',
  'reading',
  'saved',
];

const stageLabels: Record<ArcanaRitualStage, string> = {
  idle: 'Ngưỡng cửa',
  choosingTopic: 'Chủ đề',
  choosingQuestion: 'Câu hỏi',
  choosingPack: 'Gói bài',
  openingPack: 'Mở gói',
  revealingCards: 'Ba lá',
  reading: 'Lời giải',
  saved: 'Đã lưu',
};

function ArcanaRitualShell({
  stage,
  canGoBack,
  hasHistory,
  onBack,
  onClose,
  onOpenHistory,
  children,
}: ArcanaRitualShellProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const stepIndex = Math.max(0, stageOrder.indexOf(stage));
  const visibleSteps = stageOrder.slice(0, 7);

  return (
    <div className="arcana-portal fixed inset-0 z-[70] overflow-y-auto">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="arcana-room-backdrop fixed inset-0 cursor-default"
      />
      <div className="arcana-room-grid fixed inset-0" aria-hidden="true" />
      <div className={shouldReduceMotion ? 'arcana-room-light is-still' : 'arcana-room-light'} aria-hidden="true" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcana-booth-title"
        className="arcana-booth"
      >
        <header className="arcana-booth-topbar">
          <div className="arcana-booth-brand">
            <span className="arcana-sigil" aria-hidden="true">◇</span>
            <div>
              <p>Arcana Booth</p>
              <h2 id="arcana-booth-title">{t('arcana.booth')}</h2>
            </div>
          </div>

          <nav className="arcana-booth-controls" aria-label="Arcana controls">
            {canGoBack && (
              <button type="button" onClick={onBack} aria-label={t('arcana.back')}>
                Trở lại
              </button>
            )}
            {hasHistory && (
              <button type="button" onClick={onOpenHistory}>
                {t('arcana.history')}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t('common.close')}>
              Đóng
            </button>
          </nav>
        </header>

        <div className="arcana-step-track" aria-label="Tiến trình nghi thức">
          {visibleSteps.map((item, index) => {
            const active = item === stage || (stage === 'saved' && item === 'reading');
            const done = index < stepIndex || stage === 'saved';
            return (
              <span key={item} className={active ? 'is-active' : done ? 'is-done' : ''}>
                <i>{index + 1}</i>
                <b>{stageLabels[item]}</b>
              </span>
            );
          })}
        </div>

        <main className="arcana-stage" aria-live="polite">
          {children}
        </main>
      </section>
    </div>
  );
}

export default ArcanaRitualShell;
