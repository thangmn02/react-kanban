import { useI18n } from '../../i18n';

interface FocusDockHeaderProps {
  taskCount: number;
  onCollapse: () => void;
  onOpenShutdown: () => void;
}

function FocusDockHeader({ taskCount, onCollapse, onOpenShutdown }: FocusDockHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          {t('focus.dock.title')}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
          {t('focus.dock.activeTasks', { count: taskCount, plural: taskCount === 1 ? '' : 's' })}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenShutdown}
          className="cursor-pointer rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {t('focus.dock.shutdown')}
        </button>
        <button
          type="button"
          onClick={onCollapse}
          className="cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={t('focus.dock.minimizeLabel')}
        >
          {t('focus.dock.minimize')}
        </button>
      </div>
    </div>
  );
}

export default FocusDockHeader;
