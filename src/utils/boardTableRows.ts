import type { BoardData, BoardTaskItem } from '../types/task.type';

export type TableSortKey = 'title' | 'status' | 'assignee' | 'priority' | 'dueDate' | 'updatedAt';
export type TableSortDirection = 'asc' | 'desc';

export interface BoardTableRow {
  id: string;
  title: string;
  /** Parent kanban list title — surfaced as the task "status". */
  status: string;
  listId: string;
  assigneeName: string;
  assigneeAvatar?: string;
  priority: BoardTaskItem['priority'];
  dueDate?: string;
  updatedAt?: string;
  isDone: boolean;
  /** Original task item, retained so callers can open the task dialog. */
  task: BoardTaskItem;
}

const PRIORITY_RANK: Record<NonNullable<BoardTaskItem['priority']>, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
  Lowest: 3,
};

/**
 * Flattens the board's column/task structure into a flat, spreadsheet-like row
 * list. Pure / synchronous: derives "status" from the parent list title and the
 * first assignee for compact display. No filtering or sorting here — callers
 * compose this with the shared task filters and `sortTableRows`.
 */
export function buildBoardTableRows(boardData: BoardData): BoardTableRow[] {
  const listTitleById = new Map<string, string>();
  const listIdByTaskId = new Map<string, string>();

  boardData.columns.forEach((listId) => {
    const list = boardData.list[listId];
    if (!list) {
      return;
    }

    listTitleById.set(listId, list.title);
    list.tasks.forEach((taskId) => listIdByTaskId.set(taskId, listId));
  });

  return Object.values(boardData.task)
    .filter((task): task is BoardTaskItem => Boolean(task))
    .map((task) => {
      const listId = listIdByTaskId.get(task.id) || '';
      const firstAssignee = task.assignees[0];

      return {
        id: task.id,
        title: task.title,
        status: listTitleById.get(listId) || '',
        listId,
        assigneeName: firstAssignee?.name || '',
        assigneeAvatar: firstAssignee?.avatar,
        priority: task.priority,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        isDone: Boolean(task.isDone),
        task,
      };
    });
}

function compareStrings(current: string | undefined, next: string | undefined): number {
  if (!current && !next) {
    return 0;
  }
  if (!current) {
    return 1;
  }
  if (!next) {
    return -1;
  }
  return current.localeCompare(next);
}

function comparePriority(current: BoardTaskItem['priority'], next: BoardTaskItem['priority']): number {
  const currentRank = current ? PRIORITY_RANK[current] : 99;
  const nextRank = next ? PRIORITY_RANK[next] : 99;
  return currentRank - nextRank;
}

export function sortTableRows(
  rows: BoardTableRow[],
  key: TableSortKey,
  direction: TableSortDirection,
): BoardTableRow[] {
  return [...rows].sort((current, next) => {
    let comparison = 0;

    switch (key) {
      case 'title':
        comparison = compareStrings(current.title, next.title);
        break;
      case 'status':
        comparison = compareStrings(current.status, next.status);
        break;
      case 'assignee':
        comparison = compareStrings(current.assigneeName, next.assigneeName);
        break;
      case 'priority':
        comparison = comparePriority(current.priority, next.priority);
        break;
      case 'dueDate':
        comparison = compareStrings(current.dueDate, next.dueDate);
        break;
      case 'updatedAt':
        comparison = compareStrings(current.updatedAt, next.updatedAt);
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}