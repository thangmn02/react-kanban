import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  default: null,
  requireSupabaseClient: vi.fn(),
}));

import {
  localFetchBoardSnapshot,
  resetLocalBoardStore,
} from '../infrastructure/local/localBoardStore';
import { createNextRecurringTaskOccurrence, createTask, nextRecurringDueDate } from './task.service';

beforeEach(() => {
  localStorage.clear();
  resetLocalBoardStore();
});

describe('task service local mode', () => {
  it('persists a task created through the single-task API', async () => {
    const before = localFetchBoardSnapshot();
    const listId = before.listRows[0].id;

    const created = await createTask({
      board_id: before.boardId!,
      list_id: listId,
      workspace_id: 'local-mock-workspace',
      title: 'Created through task service',
    });

    const afterCreate = localFetchBoardSnapshot();

    expect(afterCreate.taskRows.find((task) => task.id === created.id)?.title).toBe(
      'Created through task service',
    );
  });

  it.each([
    ['daily', '2026-09-29'],
    ['weekly', '2026-10-05'],
    ['monthly', '2026-10-28'],
  ] as const)('calculates the next %s occurrence', (repeatInterval, expected) => {
    expect(nextRecurringDueDate('2026-09-28', repeatInterval)).toBe(expected);
  });

  it('creates a fresh recurring occurrence without checklist state', async () => {
    const before = localFetchBoardSnapshot();
    const original = await createTask({
      board_id: before.boardId!, list_id: before.listRows[0].id, title: 'Weekly review',
      description: 'Review progress', priority: 'High', due_date: '2026-09-28', repeat_interval: 'weekly',
    });
    const next = await createNextRecurringTaskOccurrence({ ...original, is_done: true });
    expect(next).toMatchObject({ title: 'Weekly review', description: 'Review progress', priority: 'High', due_date: '2026-10-05', repeat_interval: 'weekly', is_done: false });
    expect(localFetchBoardSnapshot().checklistItemRows.filter((item) => item.task_id === next?.id)).toHaveLength(0);
  });
});
