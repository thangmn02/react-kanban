import { useI18n } from '../../i18n';

interface ArcanaRewardToastProps {
  isOpen: boolean;
  availableDraws: number;
  onDrawNow: () => void;
  onLater: () => void;
}

function ArcanaRewardToast({ isOpen, availableDraws, onDrawNow, onLater }: ArcanaRewardToastProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <section
      aria-label={t('arcana.reward.eyebrow')}
      className="fixed bottom-24 right-4 z-[65] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d6b87a]/35 bg-[linear-gradient(180deg,rgba(22,16,38,0.97),rgba(8,6,18,0.98))] p-5 text-[#e8dcc4] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <div className="arcana-stars pointer-events-none absolute inset-0 overflow-hidden opacity-40" aria-hidden="true" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#d6b87a]/75">{t('arcana.reward.eyebrow')}</p>
        <h2 className="arcana-display mt-1.5 text-lg font-semibold text-[#f3e7cc]">{t('arcana.reward.title')}</h2>
        <p className="arcana-serif mt-1 text-base italic leading-snug text-[#e8dcc4]/80">{t('arcana.reward.description')}</p>
        {availableDraws > 1 && (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d6b87a]/80">
            {t('arcana.reward.pending', { count: availableDraws })}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onDrawNow}
            className="arcana-btn-gold flex-1 cursor-pointer rounded-full px-4 py-2.5 text-xs font-semibold transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/35"
          >
            {t('arcana.reward.drawNow')}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="arcana-btn-ghost cursor-pointer rounded-full px-4 py-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25"
          >
            {t('arcana.reward.later')}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ArcanaRewardToast;
