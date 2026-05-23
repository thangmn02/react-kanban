import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardTaskItem } from '../types/task.type';
import type { TaskChecklistItemInsert, TaskChecklistItemRow } from '../types/supabase.type';
import { buildChecklistItemInsertPayloads } from '../utils/boardDataMapper';

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
    throw error;
  }

  return data;
}

export async function replaceTaskChecklistItems(taskId: string, checklistItems: BoardTaskItem['checklistItems']): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error: deleteError } = await client
    .from('task_checklist_items')
    .delete()
    .eq('task_id', taskId);

  if (deleteError) {
    throw deleteError;
  }

  const checklistInsertPayloads: TaskChecklistItemInsert[] = buildChecklistItemInsertPayloads(taskId, checklistItems);

  if (checklistInsertPayloads.length === 0) {
    return;
  }

  const { error: insertError } = await client
    .from('task_checklist_items')
    .insert(checklistInsertPayloads);

  if (insertError) {
    throw insertError;
  }
}
