import { useI18n } from '../../i18n';
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';

export type NavigationView = 'home' | 'today' | 'board' | 'contact' | 'music' | 'beat-grid' | 'focus' | 'notes' | 'members';

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
  notes: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5',
  members: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4',
};

export default function AppNavigation({ activeView, onNavigate, mobile = false }: AppNavigationProps) {
  const { t } = useI18n();
  const items = [
    { view: 'home' as const, label: t('navigation.home') },
    { view: 'today' as const, label: t('app.today') },
    { view: 'board' as const, label: t('navigation.board') },
    ...(NOTES_PREVIEW_ENABLED ? [{ view: 'notes' as const, label: t('shell.notes') }] : []),
    { view: 'focus' as const, label: t('focus.mode.focus') },
    { view: 'members' as const, label: t('shell.workspace') },
    { view: 'contact' as const, label: t('navigation.contact') },
  ];
  const selected = ['board', 'calendar', 'table'].includes(activeView) ? 'board'
    : ['music', 'beat-grid'].includes(activeView) ? 'focus' : activeView;

  return (
    <nav aria-label={t('navigation.label')} className={mobile
      ? 'flex items-stretch gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1.5 lg:hidden'
      : 'fixed inset-y-0 left-0 z-40 hidden w-14 flex-col items-center gap-2 bg-[#20252D] py-5 lg:flex'}>
      {!mobile && <img src="/logo.png" alt="" className="mb-5 h-9 w-9 rounded-xl" />}
      {items.map(({ view, label }) => <button
        key={view}
        type="button"
        onClick={() => onNavigate(view)}
        aria-current={selected === view ? 'page' : undefined}
        title={label}
        className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${mobile ? 'min-w-12 flex-1 flex-col px-1' : 'w-10 flex-col px-2'} ${selected === view ? mobile?'bg-slate-100 text-slate-950':'bg-white/15 text-white ring-1 ring-inset ring-white/15' : mobile?'text-slate-500 hover:bg-slate-50 hover:text-slate-900':'text-slate-400 hover:bg-white/10 hover:text-white'}`}
      >
        <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[view]} /></svg>
        <span className={mobile ? undefined : 'sr-only'}>{label}</span>
      </button>)}
    </nav>
  );
}
