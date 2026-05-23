import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardTaskItem } from '../types/task.type';
import type {
  TaskLabelInsert,
  TaskLabelLinkInsert,
  TaskLabelLinkRow,
  TaskLabelRow,
} from '../types/supabase.type';

function normalizeLabels(labels: BoardTaskItem['labels']): BoardTaskItem['labels'] {
  return labels.reduce<BoardTaskItem['labels']>((collectedLabels, label) => {
    const normalizedName = label.name.trim();

    if (!normalizedName) {
      return collectedLabels;
    }

    const normalizedKey = normalizedName.toLowerCase();
    const hasExistingLabel = collectedLabels.some((currentLabel) => (
      currentLabel.name.trim().toLowerCase() === normalizedKey
    ));

    if (hasExistingLabel) {
      return collectedLabels;
    }

    collectedLabels.push({
      ...label,
      name: normalizedName,
    });

    return collectedLabels;
  }, []);
}

export async function fetchLabelLinksByTaskIds(taskIds: string[]): Promise<TaskLabelLinkRow[]> {
  if (!supabase || taskIds.length === 0) {
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_label_links')
    .select('*')
    .in('task_id', taskIds);

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchLabelsByIds(labelIds: string[]): Promise<TaskLabelRow[]> {
  if (!supabase || labelIds.length === 0) {
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_labels')
    .select('*')
    .in('id', labelIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function replaceTaskLabels(
  taskId: string,
  boardId: string,
  labels: BoardTaskItem['labels'],
): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const uniqueLabels = normalizeLabels(labels);

  if (uniqueLabels.length > 0) {
    const labelInsertPayloads: TaskLabelInsert[] = uniqueLabels.map((label) => ({
      id: label.id,
      board_id: boardId,
      name: label.name,
      color: label.color,
    }));

    const { error: upsertError } = await client
      .from('task_labels')
      .upsert(labelInsertPayloads, {
        onConflict: 'board_id,name',
      });

    if (upsertError) {
      throw upsertError;
    }
  }

  const { error: deleteLinksError } = await client
    .from('task_label_links')
    .delete()
    .eq('task_id', taskId);

  if (deleteLinksError) {
    throw deleteLinksError;
  }

  if (uniqueLabels.length === 0) {
    return;
  }

  const { data: persistedLabels, error: persistedLabelsError } = await client
    .from('task_labels')
    .select('*')
    .eq('board_id', boardId)
    .in('name', uniqueLabels.map((label: BoardTaskItem['labels'][number]) => label.name));

  if (persistedLabelsError) {
    throw persistedLabelsError;
  }

  const labelLinks: TaskLabelLinkInsert[] = persistedLabels.map((label: TaskLabelRow) => ({
    task_id: taskId,
    label_id: label.id,
  }));

  const { error: insertLinksError } = await client
    .from('task_label_links')
    .insert(labelLinks);

  if (insertLinksError) {
    throw insertLinksError;
  }
}
