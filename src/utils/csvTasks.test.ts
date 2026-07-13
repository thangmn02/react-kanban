import { describe, it, expect } from 'vitest';

import {
  parseTasksCsv,
  normalizeCsvPriority,
  normalizeCsvDueDate,
  tasksToCsv,
} from './csvTasks';
import type { BoardData } from '../types/task.type';

describe('parseTasksCsv', () => {
  it('parses a simple CSV with headers', () => {
    const csv = 'title,status,assignee,priority,dueDate\nTask A,Done,Alice,High,2024-01-01\nTask B,To Do,Bob,Medium,';
    const rows = parseTasksCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      title: 'Task A',
      status: 'Done',
      assignee: 'Alice',
      priority: 'High',
      dueDate: '2024-01-01',
    });
    expect(rows[1].title).toBe('Task B');
  });

  it('parses CSV without headers, treating first column as title', () => {
    // Titles deliberately avoid header keywords (task/title/name/...) so the
    // first row is treated as data rather than a header.
    const csv = 'Buy milk\nWalk dog\nFeed cat';
    const rows = parseTasksCsv(csv);

    expect(rows.map((row) => row.title)).toEqual(['Buy milk', 'Walk dog', 'Feed cat']);
    expect(rows[0].status).toBe('');
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = 'title,assignee\n"Task, with comma","Smith, John"';
    const rows = parseTasksCsv(csv);

    expect(rows[0].title).toBe('Task, with comma');
    expect(rows[0].assignee).toBe('Smith, John');
  });

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = 'title\n"Say ""hi"" now"';
    const rows = parseTasksCsv(csv);

    expect(rows[0].title).toBe('Say "hi" now');
  });

  it('drops rows with empty titles', () => {
    const csv = 'title\nTask A\n\n   \nTask B';
    const rows = parseTasksCsv(csv);

    expect(rows.map((row) => row.title)).toEqual(['Task A', 'Task B']);
  });

  it('returns empty array for empty/whitespace input', () => {
    expect(parseTasksCsv('')).toEqual([]);
    expect(parseTasksCsv('   \n  \n')).toEqual([]);
  });
});

describe('normalizeCsvPriority', () => {
  it('maps valid priorities case-insensitively', () => {
    expect(normalizeCsvPriority('high')).toBe('High');
    expect(normalizeCsvPriority('MEDIUM')).toBe('Medium');
    expect(normalizeCsvPriority('  low  ')).toBe('Low');
    expect(normalizeCsvPriority('Lowest')).toBe('Lowest');
  });

  it('returns undefined for unknown priorities', () => {
    expect(normalizeCsvPriority('urgent')).toBeUndefined();
    expect(normalizeCsvPriority('')).toBeUndefined();
  });
});

describe('normalizeCsvDueDate', () => {
  it('passes through yyyy-mm-dd unchanged', () => {
    expect(normalizeCsvDueDate('2024-03-15')).toBe('2024-03-15');
  });

  it('parses other date formats to yyyy-mm-dd', () => {
    // Use a UTC instant so the result is timezone-independent (new Date + toISOString).
    const result = normalizeCsvDueDate('2024-03-15T00:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2024-03-15');
  });

  it('returns undefined for empty or invalid dates', () => {
    expect(normalizeCsvDueDate('')).toBeUndefined();
    expect(normalizeCsvDueDate('not-a-date')).toBeUndefined();
  });
});

describe('tasksToCsv', () => {
  it('produces correct CSV output with header and rows', () => {
    const boardData: BoardData = {
      columns: ['l1'],
      list: {
        l1: { id: 'l1', title: 'To Do', tasks: ['t1'] },
      },
      task: {
        t1: {
          id: 't1',
          title: 'My Task',
          description: '',
          assignees: [{ name: 'Alice', avatar: 'a.png' }],
          priority: 'High',
          dueDate: '2024-01-01',
          isDone: false,
          updatedAt: '2024-01-02T00:00:00.000Z',
          labels: [],
          attachments: [],
          checklistItems: [],
        },
      },
    };

    const csv = tasksToCsv(boardData);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('title,status,assignee,priority,dueDate,updatedAt');
    expect(lines[1]).toBe('My Task,To Do,Alice,High,2024-01-01,2024-01-02T00:00:00.000Z');
  });

  it('escapes fields containing commas and quotes', () => {
    const boardData: BoardData = {
      columns: ['l1'],
      list: { l1: { id: 'l1', title: 'To, Do', tasks: ['t1'] } },
      task: {
        t1: {
          id: 't1',
          title: 'Say "hi"',
          description: '',
          assignees: [],
          priority: 'Low',
          dueDate: '',
          updatedAt: '',
          labels: [],
          attachments: [],
          checklistItems: [],
        },
      },
    };

    const csv = tasksToCsv(boardData);
    const lines = csv.split('\r\n');

    expect(lines[1]).toBe('"Say ""hi""","To, Do",,Low,,');
  });
});
