import type { RealtimeChannel } from '@supabase/supabase-js';

import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { TaskInsert, TaskRow, TaskUpdate } from '../types/supabase.type';

interface FetchTasksParams {
  boardId?: string;
  listId?: string;
  workspaceId?: string | null;
}

interface UpdateTaskPositionPayload {
  id: string;
  list_id: string;
  position: number;
}

function buildStableTaskInsertPayload(taskData: TaskInsert): TaskInsert {
  return {
    board_id: taskData.board_id,
    list_id: taskData.list_id,
    workspace_id: taskData.workspace_id ?? undefined,
    title: taskData.title,
    description: taskData.description ?? '',
    priority: taskData.priority ?? 'Low',
    start_date: taskData.start_date ?? null,
    due_date: taskData.due_date ?? null,
    assignees: taskData.assignees ?? [],
    image: taskData.image ?? null,
    is_done: taskData.is_done ?? false,
    position: taskData.position ?? 0,
    created_by: taskData.created_by ?? undefined,
  };
}

function buildStableTaskUpdatePayload(taskData: TaskUpdate): TaskUpdate {
  const stablePayload: TaskUpdate = {};

  if ('title' in taskData) stablePayload.title = taskData.title;
  if ('description' in taskData) stablePayload.description = taskData.description ?? '';
  if ('priority' in taskData) stablePayload.priority = taskData.priority ?? 'Low';
  if ('start_date' in taskData) stablePayload.start_date = taskData.start_date ?? null;
  if ('due_date' in taskData) stablePayload.due_date = taskData.due_date ?? null;
  if ('assignees' in taskData) stablePayload.assignees = taskData.assignees ?? [];
  if ('image' in taskData) stablePayload.image = taskData.image ?? null;
  if ('is_done' in taskData) stablePayload.is_done = taskData.is_done ?? false;
  if ('list_id' in taskData) stablePayload.list_id = taskData.list_id;
  if ('workspace_id' in taskData) stablePayload.workspace_id = taskData.workspace_id;
  if ('position' in taskData) stablePayload.position = taskData.position;
  if ('created_by' in taskData) stablePayload.created_by = taskData.created_by;
  if ('completed_at' in taskData) stablePayload.completed_at = taskData.completed_at;
  if ('deleted_at' in taskData) stablePayload.deleted_at = taskData.deleted_at;
  if ('archived_at' in taskData) stablePayload.archived_at = taskData.archived_at;

  return stablePayload;
}

export async function fetchTasks({ boardId, listId, workspaceId }: FetchTasksParams = {}): Promise<TaskRow[]> {
  if (!supabase) {
    return [];
  }

  const client = requireSupabaseClient();
  let query = client
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (boardId) {
    query = query.eq('board_id', boardId);
  }

  if (listId) {
    query = query.eq('list_id', listId);
  }

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function createTask(taskData: TaskInsert): Promise<TaskRow> {
  if (!supabase) {
    return {
      id: `task-${Date.now()}`,
      workspace_id: taskData.workspace_id ?? null,
      board_id: taskData.board_id,
      list_id: taskData.list_id,
      title: taskData.title,
      description: taskData.description || '',
      position: taskData.position ?? 0,
      priority: taskData.priority || 'Low',
      start_date: taskData.start_date || null,
      due_date: taskData.due_date || null,
      category1: taskData.category1 || null,
      category2: taskData.category2 || null,
      assignees: taskData.assignees || null,
      image: taskData.image || null,
      is_done: taskData.is_done || false,
      created_at: new Date().toISOString(),
      created_by: taskData.created_by ?? null,
      updated_at: null,
      completed_at: taskData.completed_at ?? null,
      deleted_at: null,
      archived_at: null,
    };
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('tasks')
    .insert(buildStableTaskInsertPayload(taskData))
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTask(taskId: string, taskData: TaskUpdate): Promise<TaskRow> {
  if (!supabase) {
    return {
      id: taskId,
      ...taskData,
    } as TaskRow;
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('tasks')
    .update(buildStableTaskUpdatePayload(taskData))
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}

export async function deleteTasksByListId(listId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('list_id', listId);

  if (error) {
    throw error;
  }
}

export async function updateTaskPositions(taskPositions: UpdateTaskPositionPayload[]): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  await Promise.all(taskPositions.map(async ({ id, list_id, position }) => {
    const { error } = await client
      .from('tasks')
      .update({
        list_id,
        position,
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }));
}

export function subscribeToTasksRealtime(boardId: string, onChange: () => void): RealtimeChannel {
  if (!supabase) {
    return {
      unsubscribe: () => {},
    } as unknown as RealtimeChannel;
  }

  const client = requireSupabaseClient();

  return client
    .channel(`tasks-realtime-${boardId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `board_id=eq.${boardId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();
}
