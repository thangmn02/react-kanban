import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { ITaskActivity } from '../types/task.type';
import type { Json, TaskActivityInsert, TaskActivityRow } from '../types/supabase.type';

const cacheKey = 'kanban_activities_cache';

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

// Helper for local activities
function getLocalActivities(): ITaskActivity[] {
  if (typeof window === 'undefined') return [];
  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) return [];
  try {
    return JSON.parse(cached) as ITaskActivity[];
  } catch {
    return [];
  }
}

function saveLocalActivities(activities: ITaskActivity[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(cacheKey, JSON.stringify(activities));
}

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
    const localActivity: ITaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      task_id: taskId,
      task_title: taskTitle,
      action,
      details,
      actor,
      created_at: new Date().toISOString(),
    };
    const current = getLocalActivities();
    saveLocalActivities([localActivity, ...current]);
    return localActivity;
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

  return mapActivityRowToActivity(data, taskTitle);
}

export async function fetchActivitiesForTask(taskId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    const all = getLocalActivities();
    return all
      .filter((a) => a.task_id === taskId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  return data.map((activityRow) => mapActivityRowToActivity(activityRow));
}

export async function fetchBoardActivities(boardId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    const all = getLocalActivities();
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('task_activities')
    .select('*, tasks!inner(board_id)')
    .eq('tasks.board_id', boardId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as TaskActivityRow[]).map((activityRow) => mapActivityRowToActivity(activityRow));
}
