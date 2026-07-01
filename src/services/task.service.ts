import type { RealtimeChannel } from '@supabase/supabase-js';

import supabase, { requireSupabaseClient } from '../lib/supabase';
import { DEFAULT_TASK_PRIORITY } from '../constants';
import type { Json, TaskInsert, TaskRow, TaskUpdate } from '../types/supabase.type';

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

const taskPositionRpcName = 'update_task_positions';
const taskPositionRpcPayloadKey = 'task_positions';

function summarizeTaskPositionPayload(taskPositions: UpdateTaskPositionPayload[]) {
  return {
    count: taskPositions.length,
    first: taskPositions[0]
      ? {
          id: taskPositions[0].id,
          list_id: taskPositions[0].list_id,
          position: taskPositions[0].position,
        }
      : null,
    last: taskPositions.at(-1)
      ? {
          id: taskPositions.at(-1)!.id,
          list_id: taskPositions.at(-1)!.list_id,
          position: taskPositions.at(-1)!.position,
        }
      : null,
  };
}

/**
 * Single source of truth for the default-coalescing applied to the task fields that the
 * insert and update paths normalize identically. Each normalizer reproduces the exact
 * `value ?? default` behavior of the original `buildStableTask*Payload` functions so both
 * `normalizeTaskData` (insert) and `normalizeTaskDataPartial` (update) stay byte-identical.
 */
const STABLE_TASK_FIELD_NORMALIZERS = {
  description: (value: TaskInsert['description']) => value ?? '',
  priority: (value: TaskInsert['priority']) => value ?? DEFAULT_TASK_PRIORITY,
  start_date: (value: TaskInsert['start_date']) => value ?? null,
  due_date: (value: TaskInsert['due_date']) => value ?? null,
  category1: (value: TaskInsert['category1']) => value ?? null,
  category2: (value: TaskInsert['category2']) => value ?? null,
  assignees: (value: TaskInsert['assignees']) => value ?? [],
  image: (value: TaskInsert['image']) => value ?? null,
  is_done: (value: TaskInsert['is_done']) => value ?? false,
} as const;

/**
 * Insert path: emit every field. Shared fields run through the canonical normalizers; the
 * insert-only coalescing (`workspace_id`/`created_by` -> undefined, `position` -> 0) and the
 * raw `board_id`/`list_id`/`title` pass-throughs are preserved exactly as before.
 */
function normalizeTaskData(taskData: TaskInsert): TaskInsert {
  return {
    board_id: taskData.board_id,
    list_id: taskData.list_id,
    workspace_id: taskData.workspace_id ?? undefined,
    title: taskData.title,
    description: STABLE_TASK_FIELD_NORMALIZERS.description(taskData.description),
    priority: STABLE_TASK_FIELD_NORMALIZERS.priority(taskData.priority),
    start_date: STABLE_TASK_FIELD_NORMALIZERS.start_date(taskData.start_date),
    due_date: STABLE_TASK_FIELD_NORMALIZERS.due_date(taskData.due_date),
    category1: STABLE_TASK_FIELD_NORMALIZERS.category1(taskData.category1),
    category2: STABLE_TASK_FIELD_NORMALIZERS.category2(taskData.category2),
    assignees: STABLE_TASK_FIELD_NORMALIZERS.assignees(taskData.assignees),
    image: STABLE_TASK_FIELD_NORMALIZERS.image(taskData.image),
    is_done: STABLE_TASK_FIELD_NORMALIZERS.is_done(taskData.is_done),
    position: taskData.position ?? 0,
    created_by: taskData.created_by ?? undefined,
  };
}

/**
 * Update path: emit a field only when its key is present in the input. Shared fields reuse the
 * canonical normalizers (matching the insert defaults); `title` and the pass-through keys
 * (`list_id`, `workspace_id`, `position`, `created_by`, `completed_at`, `deleted_at`,
 * `archived_at`) are assigned raw, exactly as the original update builder did.
 */
function normalizeTaskDataPartial(taskData: TaskUpdate): TaskUpdate {
  const stablePayload: TaskUpdate = {};

  if ('title' in taskData) stablePayload.title = taskData.title;
  if ('description' in taskData) stablePayload.description = STABLE_TASK_FIELD_NORMALIZERS.description(taskData.description);
  if ('priority' in taskData) stablePayload.priority = STABLE_TASK_FIELD_NORMALIZERS.priority(taskData.priority);
  if ('start_date' in taskData) stablePayload.start_date = STABLE_TASK_FIELD_NORMALIZERS.start_date(taskData.start_date);
  if ('due_date' in taskData) stablePayload.due_date = STABLE_TASK_FIELD_NORMALIZERS.due_date(taskData.due_date);
  if ('category1' in taskData) stablePayload.category1 = STABLE_TASK_FIELD_NORMALIZERS.category1(taskData.category1);
  if ('category2' in taskData) stablePayload.category2 = STABLE_TASK_FIELD_NORMALIZERS.category2(taskData.category2);
  if ('assignees' in taskData) stablePayload.assignees = STABLE_TASK_FIELD_NORMALIZERS.assignees(taskData.assignees);
  if ('image' in taskData) stablePayload.image = STABLE_TASK_FIELD_NORMALIZERS.image(taskData.image);
  if ('is_done' in taskData) stablePayload.is_done = STABLE_TASK_FIELD_NORMALIZERS.is_done(taskData.is_done);
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

  return data ?? [];
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
    .insert(normalizeTaskData(taskData))
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Task was not created.');
  }

  return data;
}

export async function createTasks(tasksData: TaskInsert[]): Promise<TaskRow[]> {
  if (!tasksData.length) return [];

  if (!supabase) {
    return tasksData.map((taskData, index) => ({
      id: `task-${Date.now()}-${index}`,
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
    }));
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('tasks')
    .insert(tasksData.map(normalizeTaskData))
    .select();

  if (error) {
    throw error;
  }

  return data ?? [];
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
    .update(normalizeTaskDataPartial(taskData))
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Task was not updated.');
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

/**
 * Restore a soft-deleted task by clearing its `deleted_at` timestamp.
 *
 * Reuses the existing task update path (`updateTask` -> `normalizeTaskDataPartial`,
 * which already passes `deleted_at` through), so no schema change is needed. The
 * task's `list_id` and `position` are untouched by `deleteTask`, so a restored
 * task reappears in its prior list and position once the board refreshes.
 *
 * - Returns the updated task whose `deleted_at` is `null`.
 * - Surfaces any update error to the caller (via `updateTask`).
 * - Without a configured Supabase client, returns a task representation with
 *   `deleted_at: null` without raising, matching the existing local-demo behavior.
 */
export async function restoreTask(taskId: string): Promise<TaskRow> {
  return updateTask(taskId, { deleted_at: null });
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
  if (!supabase || taskPositions.length === 0) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client.rpc(taskPositionRpcName, {
    [taskPositionRpcPayloadKey]: taskPositions.map(({ id, list_id, position }) => ({
      id,
      list_id,
      position,
    })) as Json,
  });

  if (error) {
    console.error('[tasks] Unable to persist drag and drop task positions.', {
      rpc: taskPositionRpcName,
      payloadKey: taskPositionRpcPayloadKey,
      payloadSummary: summarizeTaskPositionPayload(taskPositions),
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
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
