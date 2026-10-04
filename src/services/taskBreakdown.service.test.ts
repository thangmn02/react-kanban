import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ default: null }));
import { appendPlannedSteps, generateTaskBreakdown } from './taskBreakdown.service';
import { localFetchBoards, localFetchBoardSnapshot, localReplaceChecklistItems, localReplaceLabels, resetLocalBoardStore } from '../infrastructure/local/localBoardStore';

beforeEach(() => { localStorage.clear(); resetLocalBoardStore(); });
afterEach(() => vi.unstubAllGlobals());

it('sends labels, deadline and board/column context for a saved local task', async () => {
  const snapshot = localFetchBoardSnapshot();
  const task = snapshot.taskRows.find((row) => !row.is_done)!;
  localReplaceLabels(task.id, task.board_id, [{ id: 'label', name: 'Customer care', color: 'sky' }], task.workspace_id);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ steps: ['Find the customer email', 'Write the reply', 'Send the reply'] }));
  vi.stubGlobal('fetch', fetcher);
  await generateTaskBreakdown({ taskId: task.id, boardId: task.board_id, workspaceId: task.workspace_id!, language: 'en' }, new AbortController().signal);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.localContext).toMatchObject({ title: task.title, labels: ['Customer care'], dueDate: task.due_date ?? '',
    boardTitle: localFetchBoards(task.workspace_id).find((board) => board.id === task.board_id)?.title,
    columnTitle: snapshot.listRows.find((list) => list.id === task.list_id)?.title,
  });
});

it('caps unsaved draft context before sending it without changing the original draft', async () => {
  const draftContext = { title: 't'.repeat(250), description: 'd'.repeat(2500), labels: ['Design'], dueDate: '2026-10-10', boardTitle: 'Launch', columnTitle: 'Todo', existingSteps: [] };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ steps: ['Read the brief', 'Write the outline', 'Send the outline'] }));
  vi.stubGlobal('fetch', fetcher);
  await generateTaskBreakdown({ workspaceId: 'workspace', language: 'vi', draftContext }, new AbortController().signal);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.draftContext).toEqual({ ...draftContext, title: 't'.repeat(200), description: 'd'.repeat(2000) });
  expect(draftContext.title).toHaveLength(250);
  expect(draftContext.description).toHaveLength(2500);
});
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
