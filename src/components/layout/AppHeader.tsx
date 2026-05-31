import type { AppUser, AuthMode, WorkspaceSummary } from '../../types/auth.type';
import UserMenu from './UserMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface AppHeaderProps {
  authMode: AuthMode;
  user: AppUser;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: string | null;
  isLocalDemoMode: boolean;
  onGoHome: () => void;
  onGoToday: () => void;
  onOpenCommandPalette: () => void;
  onCreateBoard: () => void;
  onWorkspaceChange: (workspaceId: string | null) => void;
  onSignOut: () => void;
}

export default function AppHeader({
  authMode,
  user,
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  isLocalDemoMode,
  onGoHome,
  onGoToday,
  onOpenCommandPalette,
  onCreateBoard,
  onWorkspaceChange,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/88 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition hover:bg-slate-100/80 focus:outline-none focus:ring-4 focus:ring-sky-100"
          aria-label="Go to dashboard"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm">
            K
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold tracking-[-0.01em] text-slate-950">
              Kanban
            </span>
            <span className="block text-[11px] font-medium text-slate-500">
              Workspace
            </span>
          </span>
        </button>

        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
        />

        <button
          type="button"
          onClick={onGoToday}
          className="hidden cursor-pointer rounded-2xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-sky-100 md:inline-flex"
        >
          Today
        </button>

        {isLocalDemoMode && (
          <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Local demo
          </span>
        )}

        <div className="flex flex-1 justify-center px-1 sm:px-4">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-100 sm:w-full sm:max-w-sm sm:justify-between sm:px-3"
            aria-label="Open command menu"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <span className="hidden text-sm font-medium sm:inline">Search or command...</span>
            </span>
            <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 sm:inline">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateBoard}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100 sm:w-auto sm:px-3"
            aria-label="Create new board"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-2 hidden text-sm font-semibold sm:inline">New</span>
          </button>

          <UserMenu
            user={user}
            authMode={authMode}
            activeWorkspace={activeWorkspace}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}
