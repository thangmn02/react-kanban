import { getArcanaCardSprite } from './arcanaAtlas';
import { arcanaPackLabels } from './arcanaSystems';
import type { ArcanaReading } from './types';
import { normalizeVietnameseText } from './utils/normalizeVietnameseText';
import { useI18n } from '../../i18n';

interface ArcanaHistoryDialogProps {
  isOpen: boolean;
  readings: ArcanaReading[];
  onClose: () => void;
  onOpenReading: (reading: ArcanaReading) => void;
}

function ArcanaHistoryDialog({ isOpen, readings, onClose, onOpenReading }: ArcanaHistoryDialogProps) {
  const { language, t } = useI18n();

  if (!isOpen) return null;

  const dateLocale = language === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="arcana-portal fixed inset-0 z-[80] overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="arcana-room-backdrop fixed inset-0 cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcana-history-title"
        className="arcana-history-panel"
      >
        <div className="arcana-history-head">
          <div>
            <p>Arcana Booth</p>
            <h2 id="arcana-history-title">{t('arcana.history')}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            Đóng
          </button>
        </div>

        <div className="arcana-history-list">
          {readings.length === 0 ? (
            <p className="arcana-history-empty">{t('arcana.noHistory')}</p>
          ) : (
            readings.map((reading) => (
              <button
                key={reading.id}
                type="button"
                onClick={() => onOpenReading(reading)}
                className="arcana-history-item"
              >
                <span className="arcana-history-mini-spread">
                  {reading.cards.map((card) => (
                    <span
                      key={card.position}
                      className={`arcana-art ${card.orientation === 'reversed' ? 'rotate-180' : ''}`}
                      style={getArcanaCardSprite(card.atlas, card.atlasIndex)}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="arcana-history-copy">
                  <span>
                    <strong>{normalizeVietnameseText(reading.cards.map((card) => card.cardName).join(' · '))}</strong>
                    <time>
                      {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(reading.createdAt))}
                    </time>
                  </span>
                  <em>{normalizeVietnameseText(reading.questionText)}</em>
                  <b>{arcanaPackLabels[language][reading.packType]}</b>
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default ArcanaHistoryDialog;
