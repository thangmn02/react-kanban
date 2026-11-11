import { useMemo } from 'react';
import { useRetainedViewState } from '../../app/view-context';
import { format, parseISO } from 'date-fns';

import type { BoardData, ITaskItem } from '../../types/task.type';
import { doesTaskMatchFilters } from '../../utils/taskFilters';
import { getDueDateStatus, getPriorityBadgeClass } from '../../utils/taskMetadata';
import {
  buildBoardTableRows,
  sortTableRows,
  type TableSortDirection,
  type TableSortKey,
} from '../../utils/boardTableRows';
import EmptyState from '../atoms/EmptyState';
import { useI18n } from '../../i18n';
import { TASK_PRIORITIES } from '../../constants/task';
import type { WorkspaceMember } from '../../types/auth.type';
import { resolveAssigneeIdentity } from '../../utils/workspaceMembers';

interface TableViewProps {
  workspaceMembers?:WorkspaceMember[];
  boardData: BoardData;
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  onOpenTask: (task: ITaskItem) => void;
  /** When given, priority and due date are edited in the row. */
  onUpdateTask?: (taskId: string, fields: Partial<ITaskItem>) => Promise<void> | void;
}

function formatUpdatedAt(value: string): string {
  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

function TableView({
  workspaceMembers=[],
  boardData,
  searchQuery,
  filterPriority,
  filterAssignee,
  filterDueDate,
  onOpenTask,
  onUpdateTask,
}: TableViewProps) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useRetainedViewState<TableSortKey>('table-sort', () => 'dueDate');
  const [sortDirection, setSortDirection] = useRetainedViewState<TableSortDirection>('table-direction', () => 'asc');

  const rows = useMemo(() => {
    const allRows = buildBoardTableRows(boardData);
    const filtered = allRows.filter((row) => doesTaskMatchFilters(row.task, {
      searchQuery,
      filterPriority,
      filterAssignee,
      filterDueDate,
    }));
    return sortTableRows(filtered, sortKey, sortDirection);
  }, [boardData, searchQuery, filterPriority, filterAssignee, filterDueDate, sortKey, sortDirection]);

  const handleSort = (key: TableSortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const ariaSort = (key: TableSortKey): 'ascending' | 'descending' | undefined => {
    if (sortKey !== key) {
      return undefined;
    }
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const sortIndicator = (key: TableSortKey): string => {
    if (sortKey !== key) {
      return '';
    }
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  const renderHeader = (key: TableSortKey, label: string) => (
    <th key={key} scope="col" aria-sort={ariaSort(key)} className="px-4 py-3">
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex cursor-pointer items-center gap-1 rounded text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        {label}
        <span aria-hidden="true">{sortIndicator(key)}</span>
      </button>
    </th>
  );

  if (rows.length === 0) {
    return (
      <div className="bg-canvas p-6">
        <EmptyState
          title={t('table.empty')}
          description={t('table.emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="bg-canvas p-6">
      <div data-scroll-key="table" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {renderHeader('title', t('table.colTitle'))}
              {renderHeader('status', t('common.status'))}
              {renderHeader('assignee', t('common.assignee'))}
              {renderHeader('priority', t('common.priority'))}
              {renderHeader('dueDate', t('common.dueDate'))}
              {renderHeader('updatedAt', t('table.colUpdated'))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const displayedAssignee=row.task.assignees[0]?resolveAssigneeIdentity(row.task.assignees[0],workspaceMembers):null;
              const dueMeta = getDueDateStatus(row.dueDate, row.isDone);
              const priorityClass = getPriorityBadgeClass(row.priority) || '';
              return (
                <tr
                  key={row.id}
                  onClick={() => onOpenTask(row.task)}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={event => { event.stopPropagation(); onOpenTask(row.task); }} className={`cursor-pointer rounded text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${row.isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                      {row.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.status}</td>
                  <td className="px-4 py-3">
                    {row.assigneeName ? (
                      <div className="flex items-center gap-2">
                        {row.assigneeAvatar && (
                          <img
                            src={displayedAssignee?.avatar||row.assigneeAvatar}
                            alt={displayedAssignee?.name||row.assigneeName}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )}
                        <span className="text-slate-700">{displayedAssignee?.name||row.assigneeName}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={onUpdateTask ? event => event.stopPropagation() : undefined}>
                    {onUpdateTask ? (
                      <select
                        aria-label={t('table.editPriority', { task: row.title })}
                        value={row.priority || ''}
                        onChange={event => { void onUpdateTask(row.id, { priority: (event.target.value || undefined) as ITaskItem['priority'] }); }}
                        className={`min-h-9 cursor-pointer rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${row.priority ? priorityClass : 'bg-transparent text-slate-500'}`}
                      >
                        <option value="">—</option>
                        {TASK_PRIORITIES.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
                    ) : row.priority ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}>
                        {row.priority}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={onUpdateTask ? event => event.stopPropagation() : undefined}>
                    {onUpdateTask ? (
                      <input
                        type="date"
                        aria-label={t('table.editDueDate', { task: row.title })}
                        value={row.dueDate ? row.dueDate.slice(0, 10) : ''}
                        min={row.task.startDate ? row.task.startDate.slice(0, 10) : undefined}
                        onChange={event => {
                          const next = event.target.value;
                          // A due date before the start date is not a valid task; keep the old value.
                          if (next && row.task.startDate && next < row.task.startDate.slice(0, 10)) return;
                          void onUpdateTask(row.id, { dueDate: next || undefined });
                        }}
                        className={`min-h-9 cursor-pointer rounded-full border border-transparent px-2 py-0.5 text-xs font-medium hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${row.dueDate ? dueMeta.className : 'bg-transparent text-slate-500'}`}
                      />
                    ) : row.dueDate ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${dueMeta.className}`}>
                        {dueMeta.label}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.updatedAt ? formatUpdatedAt(row.updatedAt) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TableView;
