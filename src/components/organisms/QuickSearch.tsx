import { useEffect, useRef, useState } from 'react';

import type { TaskAssignee } from '../../types/task.type';
import { mapWorkspaceMembersToAssignees, mockWorkspaceMembers } from '../../utils/workspaceMembers';
import type { WorkspaceMember } from '../../types/auth.type';
import { useI18n } from '../../i18n';

interface QuickSearchProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (priority: string) => void;
  filterAssignee: string;
  onFilterAssigneeChange: (assigneeName: string) => void;
  filterDueDate: string;
  onFilterDueDateChange: (dueDateStatus: string) => void;
  onClearFilters: () => void;
  workspaceMembers?: WorkspaceMember[];
}

export default function QuickSearch({
  searchQuery,
  onSearchQueryChange,
  filterPriority,
  onFilterPriorityChange,
  filterAssignee,
  onFilterAssigneeChange,
  filterDueDate,
  onFilterDueDateChange,
  onClearFilters,
  workspaceMembers = mockWorkspaceMembers,
}: QuickSearchProps) {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const hasActiveFilters = searchQuery !== '' || filterPriority !== '' || filterAssignee !== '' || filterDueDate !== '';
  const assigneeOptions: TaskAssignee[] = mapWorkspaceMembersToAssignees(workspaceMembers);
  const showFilterControls = isFilterPanelOpen;
  const showAssigneeFilter = assigneeOptions.length > 1;
  const { t } = useI18n();

  useEffect(() => {
    if (!showFilterControls) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
        setIsFilterPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFilterControls]);

  return (
    <div className="relative z-20 overflow-visible border-b border-slate-200/70 bg-white/72 px-6 py-3 shadow-card backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={t('board.searchTasks')}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-inner outline-none transition focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-100"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange('')}
            type="button"
            aria-label={t('board.clearSearch')}
            title={t('board.clearSearch')}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:text-gray-700"
          >
            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div ref={filterPanelRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsFilterPanelOpen((currentValue) => !currentValue)}
          className={`inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 lg:w-auto lg:justify-start ${
            hasActiveFilters
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-expanded={showFilterControls}
        >
          {hasActiveFilters ? t('common.filtersActive') : t('common.filter')}
        </button>

        {/* Filter Controls */}
        {showFilterControls && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">{t('board.filterTasks')}</span>
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  type="button"
                  className="cursor-pointer rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('common.priority')}
              <select
                value={filterPriority}
                onChange={(e) => onFilterPriorityChange(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm normal-case tracking-normal text-slate-700 shadow-sm outline-none transition focus:ring-4 focus:ring-sky-100"
              >
                <option value="">{t('board.allPriorities')}</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Lowest">Lowest</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('common.dueDate')}
              <select
                value={filterDueDate}
                onChange={(e) => onFilterDueDateChange(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm normal-case tracking-normal text-slate-700 shadow-sm outline-none transition focus:ring-4 focus:ring-sky-100"
              >
                <option value="">{t('board.allDeadlines')}</option>
                <option value="overdue">{t('common.overdue')}</option>
                <option value="today">{t('common.dueToday')}</option>
                <option value="upcoming">{t('board.upcoming')}</option>
              </select>
            </label>

            {showAssigneeFilter && (
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('common.assignee')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {assigneeOptions.map((member) => {
                    const isSelected = filterAssignee === member.name;
                    return (
                      <button
                        key={member.name}
                        onClick={() => onFilterAssigneeChange(isSelected ? '' : member.name)}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold transition ${
                          isSelected
                            ? 'border-sky-300 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        title={t('board.filterBy', { name: member.name })}
                      >
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                        <span className="max-w-24 truncate">{member.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
