import { describe, it, expect } from 'vitest';
import { format, subDays } from 'date-fns';

import { buildTaskReport, isListTitleInProgress } from './taskReport';
import type { BoardData } from '../types/task.type';

function emptyBoard(): BoardData {
  return { columns: [], list: {}, task: {} };
}

function makeTask(overrides: Partial<BoardData['task'][string]> & { id: string }) {
  return {
    title: overrides.title ?? 'Untitled',
    description: overrides.description ?? '',
    assignees: overrides.assignees ?? [],
    labels: overrides.labels ?? [],
    attachments: overrides.attachments ?? [],
    checklistItems: overrides.checklistItems ?? [],
    ...overrides,
  };
}

function isoDaysFromNow(days: number): string {
  return format(subDays(new Date(), days), 'yyyy-MM-dd');
}

describe('buildTaskReport', () => {
  it('returns zero totals for an empty board', () => {
    const report = buildTaskReport({ boardTitle: 'Empty', boardData: emptyBoard() });

    expect(report.total).toBe(0);
    expect(report.done).toBe(0);
    expect(report.remaining).toBe(0);
    expect(report.overdue).toBe(0);
    expect(report.unassigned).toBe(0);
    expect(report.byAssignee).toEqual([]);
    expect(report.boardTitle).toBe('Empty');
  });

  it('counts done and remaining tasks from the isDone flag', () => {
    const boardData: BoardData = {
      columns: [],
      list: {},
      task: {
        t1: makeTask({ id: 't1', isDone: true }),
        t2: makeTask({ id: 't2', isDone: false }),
        t3: makeTask({ id: 't3', isDone: true }),
      },
    };

    const report = buildTaskReport({ boardTitle: 'Board', boardData });

    expect(report.total).toBe(3);
    expect(report.done).toBe(2);
    expect(report.remaining).toBe(1);
  });

  it('counts overdue tasks (due date in the past, not done)', () => {
    const boardData: BoardData = {
      columns: [],
      list: {},
      task: {
        overdue: makeTask({ id: 'overdue', isDone: false, dueDate: isoDaysFromNow(5) }),
        donePast: makeTask({ id: 'donePast', isDone: true, dueDate: isoDaysFromNow(5) }),
        upcoming: makeTask({ id: 'upcoming', isDone: false, dueDate: undefined }),
      },
    };

    const report = buildTaskReport({ boardTitle: 'Board', boardData });

    expect(report.overdue).toBe(1);
  });

  it('groups assignees by name with correct totals', () => {
    const boardData: BoardData = {
      columns: [],
      list: {},
      task: {
        t1: makeTask({
          id: 't1',
          isDone: true,
          assignees: [
            { name: 'Alice', avatar: 'a.png' },
            { name: 'Bob', avatar: 'b.png' },
          ],
        }),
        t2: makeTask({
          id: 't2',
          isDone: false,
          assignees: [{ name: 'Alice', avatar: 'a.png' }],
        }),
      },
    };

    const report = buildTaskReport({ boardTitle: 'Board', boardData });
    const alice = report.byAssignee.find((stat) => stat.name === 'Alice');
    const bob = report.byAssignee.find((stat) => stat.name === 'Bob');

    expect(alice?.total).toBe(2);
    expect(alice?.done).toBe(1);
    expect(bob?.total).toBe(1);
    expect(bob?.done).toBe(1);
    // Sorted by total descending.
    expect(report.byAssignee[0].name).toBe('Alice');
  });

  it('counts unassigned tasks', () => {
    const boardData: BoardData = {
      columns: [],
      list: {},
      task: {
        assigned: makeTask({ id: 'assigned', assignees: [{ name: 'Alice', avatar: 'a.png' }] }),
        un1: makeTask({ id: 'un1' }),
        un2: makeTask({ id: 'un2' }),
      },
    };

    const report = buildTaskReport({ boardTitle: 'Board', boardData });

    expect(report.unassigned).toBe(2);
  });

  it('uses the provided now value for generatedAt', () => {
    const now = new Date('2024-01-15T10:30:00.000Z');
    const report = buildTaskReport({ boardTitle: 'Board', boardData: emptyBoard(), now });

    expect(report.generatedAt).toBe(now.toISOString());
  });
});

describe('isListTitleInProgress', () => {
  it('returns false for undefined', () => {
    expect(isListTitleInProgress(undefined)).toBe(false);
  });

  it('detects in-progress keywords case-insensitively', () => {
    expect(isListTitleInProgress('In Progress')).toBe(true);
    expect(isListTitleInProgress('DOING')).toBe(true);
    expect(isListTitleInProgress('wip column')).toBe(true);
    expect(isListTitleInProgress('Backlog')).toBe(false);
  });
});
