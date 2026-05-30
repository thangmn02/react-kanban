import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardTaskItem } from '../types/task.type';
import type { TaskChecklistItemInsert, TaskChecklistItemRow } from '../types/supabase.type';
import { buildChecklistItemInsertPayloads } from '../utils/boardDataMapper';

function isMissingChecklistTableError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'message' in error
    && String((error as { message?: unknown }).message).includes('task_checklist_items');
}

export async function fetchChecklistItemsByTaskIds(taskIds: string[]): Promise<TaskChecklistItemRow[]> {
  if (!supabase || taskIds.length === 0) {
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_checklist_items')
    .select('*')
    .in('task_id', taskIds)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingChecklistTableError(error)) {
      console.warn('[ChecklistService] task_checklist_items table is missing. Checklist data will be skipped.');
      return [];
    }

    throw error;
  }

  return data;
}

export async function replaceTaskChecklistItems(
  taskId: string,
  checklistItems: BoardTaskItem['checklistItems'],
  workspaceId?: string | null,
): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error: deleteError } = await client
    .from('task_checklist_items')
    .delete()
    .eq('task_id', taskId);

  if (deleteError) {
    if (isMissingChecklistTableError(deleteError)) {
      console.warn('[ChecklistService] task_checklist_items table is missing. Checklist changes were skipped.');
      return;
    }

    throw deleteError;
  }

  const checklistInsertPayloads: TaskChecklistItemInsert[] = buildChecklistItemInsertPayloads(taskId, checklistItems)
    .map((checklistItem) => ({
      ...checklistItem,
      workspace_id: workspaceId ?? undefined,
    }));

  if (checklistInsertPayloads.length === 0) {
    return;
  }

  const { error: insertError } = await client
    .from('task_checklist_items')
    .insert(checklistInsertPayloads);

  if (insertError) {
    if (isMissingChecklistTableError(insertError)) {
      console.warn('[ChecklistService] task_checklist_items table is missing. Checklist changes were skipped.');
      return;
    }

    throw insertError;
  }
}
