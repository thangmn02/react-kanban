import type { BoardData, BoardTaskItem } from '../types/task.type';

/**
 * Lightweight, local-first CSV helpers for the board Table View workflow.
 * No external CSV dependency: parsing/serializing is a small RFC-4180-ish
 * state machine that handles quoted fields, escaped quotes and embedded
 * newlines. Export reuses the existing in-memory board data model so it works
 * identically in mock (local) and Supabase modes.
 */

export interface CsvTaskRow {
  title: string;
  status: string;
  assignee: string;
  priority: string;
  dueDate: string;
  updatedAt: string;
}

export interface ParsedCsvTask {
  title: string;
  status: string;
  assignee: string;
  priority: string;
  dueDate: string;
}

const EXPORT_COLUMNS = ['title', 'status', 'assignee', 'priority', 'dueDate', 'updatedAt'] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Flattens the board's column/task structure into spreadsheet-like rows and
 * serializes them to a CSV string. "status" is derived from the parent list
 * title; "assignee" is the first assignee name for compact display. Pure /
 * synchronous — no side effects.
 */
export function tasksToCsv(boardData: BoardData): string {
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

  const rows: CsvTaskRow[] = Object.values(boardData.task)
    .filter((task): task is BoardTaskItem => Boolean(task))
    .map((task) => ({
      title: task.title,
      status: listTitleById.get(listIdByTaskId.get(task.id) || '') || '',
      assignee: task.assignees[0]?.name || '',
      priority: task.priority || '',
      dueDate: task.dueDate || '',
      updatedAt: task.updatedAt || '',
    }));

  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => escapeCsvField(row[column])).join(','),
  );

  return [header, ...lines].join('\r\n');
}

/**
 * Triggers a browser download for the given text content. A UTF-8 BOM is
 * prepended so spreadsheet apps (Excel/Google Sheets) decode UTF-8 correctly.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8;',
): void {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Parses CSV text into a matrix of string cells, honoring quoted fields. */
function parseCsvMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[index + 1] === '"') {
          field += '"';
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(field);
      rows.push(currentRow);
      currentRow = [];
      field = '';
      continue;
    }

    field += char;
  }

  // Flush the final field/row (file without trailing newline).
  currentRow.push(field);
  rows.push(currentRow);

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '');
}

function findColumnIndex(header: string[], names: string[]): number {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

/**
 * Parses CSV text into task rows. Column detection is header-driven and
 * tolerant of common variants (e.g. "Due Date", "due_date", "owner"). If no
 * recognizable header is present, every row is treated as data with the title
 * in the first column. Rows with an empty title are dropped.
 */
export function parseTasksCsv(text: string): ParsedCsvTask[] {
  const matrix = parseCsvMatrix(text).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (matrix.length === 0) {
    return [];
  }

  const header = matrix[0].map(normalizeHeader);
  const hasHeader = header.some((value) => /title|name|task|status|assignee|priority|due/i.test(value));

  const titleIdx = findColumnIndex(header, ['title', 'name', 'task']);
  const statusIdx = findColumnIndex(header, ['status', 'list', 'column', 'state']);
  const assigneeIdx = findColumnIndex(header, ['assignee', 'owner', 'assignedto']);
  const priorityIdx = findColumnIndex(header, ['priority']);
  const dueDateIdx = findColumnIndex(header, ['duedate', 'deadline']);

  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  const titleColumn = hasHeader && titleIdx >= 0 ? titleIdx : 0;

  return dataRows
    .map((row) => ({
      title: (row[titleColumn] || '').trim(),
      status: statusIdx >= 0 ? (row[statusIdx] || '').trim() : '',
      assignee: assigneeIdx >= 0 ? (row[assigneeIdx] || '').trim() : '',
      priority: priorityIdx >= 0 ? (row[priorityIdx] || '').trim() : '',
      dueDate: dueDateIdx >= 0 ? (row[dueDateIdx] || '').trim() : '',
    }))
    .filter((row) => row.title.length > 0);
}

const VALID_CSV_PRIORITIES = ['High', 'Medium', 'Low', 'Lowest'] as const;

/** Maps a free-form CSV priority cell to a known priority, case-insensitively. */
export function normalizeCsvPriority(value: string): BoardTaskItem['priority'] | undefined {
  const normalized = value.trim().toLowerCase();
  return VALID_CSV_PRIORITIES.find((priority) => priority.toLowerCase() === normalized);
}

/** Maps a free-form CSV due-date cell to an ISO `yyyy-mm-dd` string when parseable. */
export function normalizeCsvDueDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().split('T')[0];
}
