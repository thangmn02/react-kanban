import supabase from '../lib/supabase';
import { localFetchAllTasks, localFetchBoardSnapshot, localReplaceChecklistItems } from '../infrastructure/local/localBoardStore';
import type { TaskChecklistItem } from '../types/task.type';
import { MAX_STEP_LENGTH, parseTaskSteps } from '../features/today/utils/taskBreakdown';

interface BreakdownInput {
  taskId?: string;
  boardId?: string;
  workspaceId: string;
  language: 'en' | 'vi';
  draftContext?: { title: string; description: string; existingSteps: string[] };
}

export async function generateTaskBreakdown(input: BreakdownInput, signal: AbortSignal): Promise<string[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let localContext: BreakdownInput['draftContext'];
  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('unauthorized');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  } else if (input.taskId) {
    const snapshot = localFetchBoardSnapshot(input.boardId, input.workspaceId);
    const task = snapshot.taskRows.find((row) => row.id === input.taskId && !row.is_done);
    if (!task) throw new Error('task_unavailable');
    localContext = { title: task.title, description: (task.description ?? '').slice(0, 3000), existingSteps: snapshot.checklistItemRows.filter((item) => item.task_id === task.id).slice(0, 30).map((item) => item.content) };
  }
  const response = await fetch('/api/task-breakdown', {
    method: 'POST', headers, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    body: JSON.stringify({ ...input, localContext }),
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('not_configured'); }
  if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : 'unavailable');
  return parseTaskSteps(payload);
}

/** Append only; stable draft IDs make retries safe if a save response is lost. */
export async function appendPlannedSteps(taskId: string, boardId: string, workspaceId: string, items: TaskChecklistItem[]): Promise<void> {
  if (!items.length || items.length > 3 || items.some((item) => !item.text.trim() || item.text.trim().length > MAX_STEP_LENGTH)) throw new Error('invalid_request');
  if (!supabase) {
    const task = localFetchAllTasks(workspaceId).find((item) => item.id === taskId && item.board_id === boardId && !item.is_done);
    if (!task) throw new Error('task_unavailable');
    const current = localFetchBoardSnapshot(boardId, workspaceId).checklistItemRows.filter((item) => item.task_id === taskId);
    const existing = current.map((item) => ({ id: item.id, text: item.content, isDone: item.is_done }));
    const added = items.filter((item) => !existing.some((row) => row.id === item.id || row.text.trim().toLocaleLowerCase() === item.text.trim().toLocaleLowerCase()));
    localReplaceChecklistItems(taskId, [...existing, ...added.map((item) => ({ ...item, text: item.text.trim(), isDone: false }))], workspaceId);
    return;
  }
  const { data: task, error: taskError } = await supabase.from('tasks').select('id').eq('id', taskId).eq('board_id', boardId).eq('workspace_id', workspaceId).is('archived_at', null).is('deleted_at', null).eq('is_done', false).maybeSingle();
  if (taskError || !task) throw new Error('task_unavailable');
  const { data: current, error } = await supabase.from('task_checklist_items').select('id,content,position').eq('task_id', taskId).eq('workspace_id', workspaceId);
  if (error) throw new Error('save_failed');
  const nextPosition = Math.max(-1, ...(current ?? []).map((item) => item.position ?? 0)) + 1;
  const added = items.filter((item) => !(current ?? []).some((row) => row.id === item.id || row.content.trim().toLocaleLowerCase() === item.text.trim().toLocaleLowerCase()));
  if (!added.length) return;
  const { error: saveError } = await supabase.from('task_checklist_items').upsert(added.map((item, index) => ({ id: item.id, task_id: taskId, workspace_id: workspaceId, content: item.text.trim(), is_done: false, position: nextPosition + index })), { onConflict: 'id', ignoreDuplicates: true });
  if (saveError) throw new Error('save_failed');
}
