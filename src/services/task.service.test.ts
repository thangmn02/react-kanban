import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  default: null,
  requireSupabaseClient: vi.fn(),
}));

import {
  localFetchBoardSnapshot,
  resetLocalBoardStore,
} from '../infrastructure/local/localBoardStore';
import { createTask } from './task.service';

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
});
