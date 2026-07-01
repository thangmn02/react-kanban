import { useMemo, useState } from 'react';
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

interface TableViewProps {
  boardData: BoardData;
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  onOpenTask: (task: ITaskItem) => void;
}

function formatUpdatedAt(value: string): string {
  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

function TableView({
  boardData,
  searchQuery,
  filterPriority,
  filterAssignee,
  filterDueDate,
  onOpenTask,
}: TableViewProps) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<TableSortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<TableSortDirection>('asc');

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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
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
              const dueMeta = getDueDateStatus(row.dueDate, row.isDone);
              const priorityClass = getPriorityBadgeClass(row.priority) || '';
              return (
                <tr
                  key={row.id}
                  onClick={() => onOpenTask(row.task)}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <span className={`font-medium ${row.isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {row.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.status}</td>
                  <td className="px-4 py-3">
                    {row.assigneeName ? (
                      <div className="flex items-center gap-2">
                        {row.assigneeAvatar && (
                          <img
                            src={row.assigneeAvatar}
                            alt={row.assigneeName}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )}
                        <span className="text-slate-700">{row.assigneeName}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.priority ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}>
                        {row.priority}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.dueDate ? (
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