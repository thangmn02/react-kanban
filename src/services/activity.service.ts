import supabase, { requireSupabaseClient } from '../lib/supabase';
import {
  localCreateActivity,
  localFetchActivitiesForTask,
  localFetchBoardActivities,
} from '../infrastructure/local/localBoardStore';
import type { ITaskActivity } from '../types/task.type';
import type { Json, TaskActivityInsert, TaskActivityRow } from '../types/supabase.type';


const DEFAULT_ACTOR = {
  name: 'You',
  avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png',
};

const TASK_ACTIVITY_ACTIONS: ITaskActivity['action'][] = [
  'create',
  'update',
  'move',
  'priority_change',
  'assignee_change',
  'status_change',
  'deleted',
];



function normalizeActivityAction(action: string): ITaskActivity['action'] {
  return TASK_ACTIVITY_ACTIONS.includes(action as ITaskActivity['action'])
    ? action as ITaskActivity['action']
    : 'update';
}

function normalizeActivityDetails(details: Json): ITaskActivity['details'] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return { description: '' };
  }

  const description = typeof details.description === 'string' ? details.description : '';

  return {
    description,
    field: typeof details.field === 'string' ? details.field : undefined,
    oldValue: details.oldValue,
    newValue: details.newValue,
  };
}

function normalizeActivityActor(actor: Json): ITaskActivity['actor'] {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
    return DEFAULT_ACTOR;
  }

  return {
    name: typeof actor.name === 'string' ? actor.name : DEFAULT_ACTOR.name,
    avatar: typeof actor.avatar === 'string' ? actor.avatar : DEFAULT_ACTOR.avatar,
  };
}

function mapActivityRowToActivity(activityRow: TaskActivityRow, taskTitle?: string): ITaskActivity {
  return {
    id: activityRow.id,
    task_id: activityRow.task_id,
    task_title: taskTitle,
    action: normalizeActivityAction(activityRow.action),
    details: normalizeActivityDetails(activityRow.details),
    actor: normalizeActivityActor(activityRow.actor),
    created_at: activityRow.created_at,
  };
}

export async function createActivity(
  taskId: string,
  action: ITaskActivity['action'],
  details: ITaskActivity['details'],
  actor = DEFAULT_ACTOR,
  taskTitle?: string,
  context?: {
    workspaceId?: string | null;
    boardId?: string | null;
    actorId?: string | null;
  }
): Promise<ITaskActivity> {
  const newActivity: TaskActivityInsert = {
    task_id: taskId,
    action,
    details: details as Json,
    actor: actor as Json,
    workspace_id: context?.workspaceId ?? undefined,
    board_id: context?.boardId ?? undefined,
    actor_id: context?.actorId ?? undefined,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    const row = localCreateActivity({
      task_id: taskId,
      task_title: taskTitle ?? null,
      action,
      details: details as Json,
      actor: actor as Json,
      actor_id: context?.actorId ?? null,
      board_id: context?.boardId ?? null,
      workspace_id: context?.workspaceId ?? null,
    });
    return mapActivityRowToActivity(row, taskTitle ?? undefined);
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_activities')
    .insert(newActivity)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Activity was not created.');
  }

  return mapActivityRowToActivity(data, taskTitle);
}

export async function fetchActivitiesForTask(taskId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    return localFetchActivitiesForTask(taskId).map((row) => mapActivityRowToActivity(row));
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_activities')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((activityRow) => mapActivityRowToActivity(activityRow));
}

export async function fetchBoardActivities(boardId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    return localFetchBoardActivities(boardId).map((row) => mapActivityRowToActivity(row));
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_activities')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TaskActivityRow[]).map((activityRow) => mapActivityRowToActivity(activityRow));
}
