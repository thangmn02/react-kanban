import { useI18n } from '../../i18n';

export type NavigationView = 'home' | 'today' | 'board';

interface AppNavigationProps {
  activeView: string;
  onNavigate: (view: NavigationView) => void;
  mobile?: boolean;
}

const paths: Record<NavigationView, string> = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  today: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  board: 'M3 4h4v16H3ZM10 4h4v10h-4ZM17 4h4v13h-4Z',
};

export default function AppNavigation({ activeView, onNavigate, mobile = false }: AppNavigationProps) {
  const { t } = useI18n();
  const items = [
    { view: 'home' as const, label: t('navigation.home') },
    { view: 'today' as const, label: t('app.today') },
    { view: 'board' as const, label: t('navigation.board') },
  ];
  const selected = ['board', 'calendar', 'table'].includes(activeView) ? 'board' : activeView;

  return (
    <nav aria-label={t('navigation.label')} className={mobile
      ? 'flex items-center gap-1 border-t border-slate-100 px-3 py-1.5 lg:hidden'
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
