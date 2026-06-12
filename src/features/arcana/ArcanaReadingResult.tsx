import {
  arcanaFinishLabels,
  arcanaOrientationLabels,
  arcanaSpreadLabels,
} from './arcanaSystems';
import type { ArcanaReading } from './types';
import { useI18n } from '../../i18n';

interface ArcanaReadingResultProps {
  reading: ArcanaReading | null;
  onDrawAgain: () => void;
  onSave: () => void;
  onClose: () => void;
}

const rarityHue: Record<string, string> = {
  common: 'text-slate-200/80 border-slate-200/25',
  uncommon: 'text-emerald-200 border-emerald-300/30',
  rare: 'text-sky-200 border-sky-300/30',
  epic: 'text-fuchsia-200 border-fuchsia-300/30',
  legendary: 'text-amber-200 border-amber-300/40',
  mythic: 'text-rose-200 border-rose-300/40',
};

function ArcanaReadingResult({ reading, onDrawAgain, onSave, onClose }: ArcanaReadingResultProps) {
  const { language, t } = useI18n();

  if (!reading) {
    return (
      <div className="arcana-serif mx-auto max-w-md text-center text-lg italic text-[#e8dcc4]/70">
        {t('arcana.emptyReading')}
      </div>
    );
  }

  const sections = reading.messageSnapshot.split('\n\n');

  return (
    <section className="mx-auto w-full max-w-2xl">
      {/* Inscribed vellum panel */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d6b87a]/30 bg-[linear-gradient(180deg,rgba(26,20,40,0.9),rgba(12,9,24,0.92))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5" aria-hidden="true" />

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b87a]/70">
          {t('arcana.readingForQuestion')}
        </p>
        <h3 className="arcana-display mt-2 text-center text-xl font-semibold text-[#f3e7cc] sm:text-2xl">
          {reading.questionText}
        </h3>

        {/* Per-card chips */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
          {reading.cards.map((card) => (
            <span
              key={card.position}
              className={`rounded-full border bg-white/[0.03] px-3 py-1 ${rarityHue[card.rarity]}`}
              title={`${card.cardName} · ${arcanaFinishLabels[language][card.finish]} · ${arcanaOrientationLabels[language][card.orientation]}`}
            >
              {arcanaSpreadLabels[language][card.position]} · {card.cardName}
            </span>
          ))}
        </div>

        <div className="arcana-rule my-6" aria-hidden="true" />

        {/* Reading body */}
        <div className="max-h-[40vh] space-y-5 overflow-y-auto pr-1">
          {sections.map((section) => {
            const [heading, ...body] = section.split('\n');
            return (
              <div key={heading}>
                <h4 className="arcana-display text-base font-semibold tracking-[0.06em] text-[#d6b87a]">{heading}</h4>
                <p className="arcana-serif mt-1.5 whitespace-pre-line text-[1.08rem] leading-relaxed text-[#efe6d2]/90">
                  {body.join('\n')}
                </p>
              </div>
            );
          })}
        </div>

        <p className="arcana-serif mt-6 text-center text-sm italic text-[#d6b87a]/60">
          {t('arcana.disclaimer')}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onSave}
          className="arcana-btn-gold w-full cursor-pointer rounded-full px-8 py-3 text-sm font-semibold transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/35 sm:w-auto"
        >
          {t('arcana.saveReading')}
        </button>
        <button
          type="button"
          onClick={onDrawAgain}
          className="arcana-btn-ghost w-full cursor-pointer rounded-full px-8 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25 sm:w-auto"
        >
          {t('arcana.drawAgain')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#e8dcc4]/60 transition hover:text-[#e8dcc4] focus:outline-none"
        >
          {t('common.close')}
        </button>
      </div>
    </section>
  );
}

export default ArcanaReadingResult;
