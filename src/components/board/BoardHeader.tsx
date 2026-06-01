import type { BoardRow } from '../../types/supabase.type';
import type { WorkspaceMember } from '../../types/auth.type';
import BoardTabs, { type BoardTabId } from './BoardTabs';

interface BoardHeaderProps {
  activeBoardId: string | null;
  activeBoardSummary: BoardRow | null;
  boardSummaries: BoardRow[];
  activeTab: BoardTabId;
  workspaceMembers: WorkspaceMember[];
  onBoardChange: (boardId: string | null) => void;
  onTabChange: (tab: BoardTabId) => void;
  onOpenMembers: () => void;
  onOpenActivity: () => void;
}

export default function BoardHeader({
  activeBoardId,
  activeBoardSummary,
  boardSummaries,
  activeTab,
  workspaceMembers,
  onBoardChange,
  onTabChange,
  onOpenMembers,
  onOpenActivity,
}: BoardHeaderProps) {
  return (
    <section className="border-b border-slate-200/70 bg-white/72 px-4 py-5 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
            Active board
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <select
              value={activeBoardId || ''}
              onChange={(event) => onBoardChange(event.target.value || null)}
              className="max-w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-lg font-semibold tracking-[-0.02em] text-slate-950 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 sm:min-w-64"
              aria-label="Active board"
            >
              {boardSummaries.map((boardSummary) => (
                <option key={boardSummary.id} value={boardSummary.id}>
                  {boardSummary.title}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {activeBoardSummary?.description || 'Kanban workspace with realtime tasks, lists, and richer task details.'}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onOpenMembers}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <span className="flex -space-x-2">
              {workspaceMembers.slice(0, 3).map((member) => (
                <img
                  key={member.id}
                  src={member.avatarUrl}
                  alt={member.name}
                  className="h-6 w-6 rounded-full border-2 border-white object-cover"
                />
              ))}
            </span>
            Members
          </button>

          <BoardTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            onOpenActivity={onOpenActivity}
          />
        </div>
      </div>
    </section>
  );
}
