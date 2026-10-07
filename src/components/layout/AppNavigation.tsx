import { useI18n } from '../../i18n';

export type NavigationView = 'home' | 'today' | 'board' | 'contact' | 'music' | 'beat-grid' | 'focus';

interface AppNavigationProps {
  activeView: string;
  onNavigate: (view: NavigationView) => void;
  mobile?: boolean;
}

const paths: Record<NavigationView, string> = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  today: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  board: 'M3 4h4v16H3ZM10 4h4v10h-4ZM17 4h4v13h-4Z',
  contact: 'M4 4h16v12H8l-4 4ZM8 8h8M8 12h5',
  music: 'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3Zm12-2a3 3 0 1 1-3-3c2 0 3 1 3 3Z',
  'beat-grid': 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  focus: 'M9 2h6M12 6v6l3 2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

export default function AppNavigation({ activeView, onNavigate, mobile = false }: AppNavigationProps) {
  const { t } = useI18n();
  const items = [
    { view: 'home' as const, label: t('navigation.home') },
    { view: 'today' as const, label: t('app.today') },
    { view: 'board' as const, label: t('navigation.board') },
    { view: 'music' as const, label: t('focus.island.music') },
    { view: 'beat-grid' as const, label: t('dock.beatGrid') },
    { view: 'focus' as const, label: t('focus.mode.focus') },
    { view: 'contact' as const, label: t('navigation.contact') },
  ];
  const selected = ['board', 'calendar', 'table'].includes(activeView) ? 'board' : activeView;

  return (
    <nav aria-label={t('navigation.label')} className={mobile
      ? 'flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden'
      : 'fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-2 border-r border-slate-200 bg-white py-5 lg:flex'}>
      {!mobile && <img src="/logo.png" alt="" className="mb-5 h-9 w-9 rounded-xl" />}
      {items.map(({ view, label }) => <button
        key={view}
        type="button"
        onClick={() => onNavigate(view)}
        aria-current={selected === view ? 'page' : undefined}
        className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${mobile ? 'flex-1' : 'w-16 flex-col'} ${selected === view ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
      >
        <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[view]} /></svg>
        {label}
      </button>)}
    </nav>
  );
}
