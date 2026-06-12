import { getArcanaCardSprite } from './arcanaAtlas';
import { arcanaPackLabels } from './arcanaSystems';
import type { ArcanaReading } from './types';
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="arcana-void fixed inset-0 cursor-default opacity-95" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcana-history-title"
        className="relative z-10 mx-auto w-full max-w-xl rounded-3xl border border-[#d6b87a]/30 bg-[linear-gradient(180deg,rgba(20,15,34,0.96),rgba(8,6,18,0.98))] p-6 text-[#e8dcc4] shadow-[0_30px_100px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#d6b87a]/70">{t('arcana.booth')}</p>
            <h2 id="arcana-history-title" className="arcana-display mt-1 text-2xl font-semibold text-[#f3e7cc]">
              {t('arcana.history')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-white/15 text-[#e8dcc4]/80 transition hover:border-white/35 hover:bg-white/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/15"
          >
            ✕
          </button>
        </div>

        <div className="arcana-rule my-5" aria-hidden="true" />

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          {readings.length === 0 ? (
            <p className="arcana-serif py-8 text-center text-lg italic text-[#e8dcc4]/60">{t('arcana.noHistory')}</p>
          ) : (
            readings.map((reading) => (
              <button
                key={reading.id}
                type="button"
                onClick={() => onOpenReading(reading)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-left transition hover:border-[#d6b87a]/40 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25"
              >
                <span className="flex flex-none gap-1">
                  {reading.cards.map((card) => (
                    <span
                      key={card.position}
                      className={`arcana-art h-14 w-[2.6rem] rounded border border-white/15 ${card.orientation === 'reversed' ? 'rotate-180' : ''}`}
                      style={getArcanaCardSprite(card.atlas, card.atlasIndex)}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="arcana-display line-clamp-1 text-sm font-semibold text-[#f3e7cc]">
                      {reading.cards.map((card) => card.cardName).join(' · ')}
                    </span>
                    <span className="flex-none text-[10px] uppercase tracking-[0.1em] text-[#d6b87a]/70">
                      {new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(reading.createdAt))}
                    </span>
                  </span>
                  <span className="arcana-serif mt-1 line-clamp-1 block text-base italic text-[#e8dcc4]/70">{reading.questionText}</span>
                  <span className="mt-1.5 inline-flex rounded-full border border-[#d6b87a]/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d6b87a]/80">
                    {arcanaPackLabels[language][reading.packType]}
                  </span>
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
