import { useI18n } from '../../../i18n';

interface QuickCreateTodayTaskProps {
  onQuickCreate: () => void;
}

export default function QuickCreateTodayTask({ onQuickCreate }: QuickCreateTodayTaskProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onQuickCreate}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {t('dailyRitual.quickCreate')}
    </button>
  );
}
