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
  const tabClassName = (tab: BoardTabId) => (
    `cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
      activeTab === tab
        ? 'bg-white text-slate-950 shadow-sm'
        : 'text-slate-500 hover:text-slate-800'
    }`
  );

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Board views">
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
        <button
          type="button"
          onClick={() => onTabChange('board')}
          className={tabClassName('board')}
          aria-current={activeTab === 'board' ? 'page' : undefined}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => onTabChange('calendar')}
          className={tabClassName('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
        >
          Calendar
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenActivity}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100"
      >
        Activity
      </button>
    </nav>
  );
}
