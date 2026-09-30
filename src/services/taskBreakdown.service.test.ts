import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ default: null }));
import { appendPlannedSteps } from './taskBreakdown.service';
import { localFetchBoardSnapshot, localReplaceChecklistItems, resetLocalBoardStore } from '../infrastructure/local/localBoardStore';

beforeEach(() => { localStorage.clear(); resetLocalBoardStore(); });
it('appends to the correct board without losing completed items, and retries do not duplicate steps', async () => {
  const snapshot = localFetchBoardSnapshot();
  const task = snapshot.taskRows.find((row) => !row.is_done)!;
  if (!task.workspace_id) throw new Error('Seed task requires a workspace');
  const existing = { id: crypto.randomUUID(), text: 'Finished research', isDone: true };
  localReplaceChecklistItems(task.id, [existing], task.workspace_id);
  const steps = [{ id: crypto.randomUUID(), text: 'Write the outline', isDone: false }];
  await appendPlannedSteps(task.id, task.board_id, task.workspace_id, steps);
  await appendPlannedSteps(task.id, task.board_id, task.workspace_id, steps);
  const saved = localFetchBoardSnapshot(task.board_id, task.workspace_id).checklistItemRows.filter((row) => row.task_id === task.id);
  expect(saved).toHaveLength(2);
  expect(saved[0]).toMatchObject({ id: existing.id, content: existing.text, is_done: true });
  expect(saved[1]).toMatchObject({ id: steps[0].id, content: steps[0].text, is_done: false });
  await expect(appendPlannedSteps(task.id, task.board_id, 'other-workspace', steps)).rejects.toThrow('task_unavailable');
});
