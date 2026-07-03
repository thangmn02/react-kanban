import { useEffect, useRef, useState } from 'react';

import type { BoardRow } from '../../types/supabase.type';
import type { WorkspaceMember } from '../../types/auth.type';
import BoardTabs, { type BoardTabId } from './BoardTabs';
import { useI18n } from '../../i18n';
import BoardBackgroundPicker from './BoardBackgroundPicker';

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
  onQuickAddTask: () => void;
  onOpenQuickPlan: () => void;
  onOpenProgressReport: () => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
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
  onQuickAddTask,
  onOpenQuickPlan,
  onOpenProgressReport,
  onExportCsv,
  onImportCsv,
}: BoardHeaderProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const hasTeamMembers = workspaceMembers.length > 1;
  const { t } = useI18n();

  useEffect(() => {
    if (!isOptionsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOptionsOpen]);

  return (
    <section className="relative z-30 overflow-visible border-b border-slate-200/70 bg-white/72 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeBoardId || ''}
              onChange={(event) => onBoardChange(event.target.value || null)}
              className="max-w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-base font-semibold tracking-[-0.02em] text-slate-950 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 sm:min-w-64"
              aria-label={t('board.activeBoard')}
            >
              {boardSummaries.map((boardSummary) => (
                <option key={boardSummary.id} value={boardSummary.id}>
                  {boardSummary.title}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-500 md:block">
            {activeBoardSummary?.description || t('board.defaultDescription')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onQuickAddTask}
            className="inline-flex cursor-pointer items-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            {t('board.addTask')}
          </button>

          <div ref={optionsRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsOptionsOpen((currentValue) => !currentValue)}
              className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              aria-expanded={isOptionsOpen}
            >
              {t('board.options')}
            </button>

            {isOptionsOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-max min-w-52 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-md">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onOpenQuickPlan();
                  }}
                  className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {t('board.quickPlan')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onOpenProgressReport();
                  }}
                  className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {t('report.title')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onExportCsv();
                  }}
                  className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {t('csv.export')}
                </button>

                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {t('csv.import')}
                </button>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setIsOptionsOpen(false);
                    if (file) {
                      onImportCsv(file);
                    }
                    event.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    onOpenMembers();
                  }}
                  className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {hasTeamMembers && (
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
                  )}
                  {hasTeamMembers ? t('board.members') : t('board.invitePeople')}
                </button>

                <div className="border-t border-slate-100 pt-2">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t('board.bg.title')}
                  </p>
                  {activeBoardId && (
                    <BoardBackgroundPicker boardId={activeBoardId} />
                  )}
                </div>

                <BoardTabs
                  activeTab={activeTab}
                  onTabChange={(tab) => {
                    setIsOptionsOpen(false);
                    onTabChange(tab);
                  }}
                  onOpenActivity={() => {
                    setIsOptionsOpen(false);
                    onOpenActivity();
                  }}
                />
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
