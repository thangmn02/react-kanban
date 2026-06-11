import { useI18n } from '../../i18n';

export type BoardTabId = 'board' | 'calendar';

interface BoardTabsProps {
  activeTab: BoardTabId;
  onTabChange: (tab: BoardTabId) => void;
  onOpenActivity: () => void;
}

export default function BoardTabs({
  activeTab,
  onTabChange,
  onOpenActivity,
}: BoardTabsProps) {
  const { t } = useI18n();
  const tabClassName = (tab: BoardTabId) => (
    `w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
      activeTab === tab
        ? 'bg-slate-100 text-slate-950'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`
  );

  return (
    <nav className="grid gap-1" aria-label={t('board.views.label')}>
      <div className="grid gap-1">
        <button
          type="button"
          onClick={() => onTabChange('board')}
          className={tabClassName('board')}
          aria-current={activeTab === 'board' ? 'page' : undefined}
        >
          {t('board.views.board')}
        </button>
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={tabClassName('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
        >
          {t('board.views.calendar')}
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenActivity}
        className="w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        {t('board.views.activity')}
      </button>
    </nav>
  );
}
