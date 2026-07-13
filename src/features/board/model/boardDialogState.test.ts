import { describe, expect, it } from 'vitest';

import {
  CLOSED_BOARD_DIALOG,
  isBoardDialogOpen,
  type BoardDialogState,
} from './boardDialogState';

describe('BoardDialogState (discriminated union)', () => {
  it('treats the closed variant as not open', () => {
    expect(isBoardDialogOpen(CLOSED_BOARD_DIALOG)).toBe(false);
  });

  it('treats every open variant as open', () => {
    const openStates: BoardDialogState[] = [
      { type: 'create-task', listId: 'l1' },
      { type: 'edit-task', taskId: 't1' },
      { type: 'create-list' },
      { type: 'create-board' },
      { type: 'board-settings' },
    ];
    for (const state of openStates) {
      expect(isBoardDialogOpen(state)).toBe(true);
    }
  });

  it('narrows to the correct payload per variant', () => {
    const createTask: BoardDialogState = { type: 'create-task', listId: 'l1' };
    const editTask: BoardDialogState = { type: 'edit-task', taskId: 't1' };

    if (createTask.type === 'create-task') {
      expect(createTask.listId).toBe('l1');
    }
    if (editTask.type === 'edit-task') {
      expect(editTask.taskId).toBe('t1');
    }
  });
});
