import supabase from '../lib/supabase';
import type { ITaskActivity } from '../types/task.type';

const cacheKey = 'kanban_activities_cache';

const DEFAULT_ACTOR = {
  name: 'You',
  avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png',
};

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

export async function createActivity(
  taskId: string,
  action: ITaskActivity['action'],
  details: ITaskActivity['details'],
  actor = DEFAULT_ACTOR,
  taskTitle?: string
): Promise<ITaskActivity> {
  const newActivity: Omit<ITaskActivity, 'id'> = {
    task_id: taskId,
    task_title: taskTitle,
    action,
    details,
    actor,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    const localActivity: ITaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...newActivity,
    };
    const current = getLocalActivities();
    saveLocalActivities([localActivity, ...current]);
    return localActivity;
  }

  const { data, error } = await supabase
    .from('task_activities')
    .insert(newActivity)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as ITaskActivity;
}

export async function fetchActivitiesForTask(taskId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    const all = getLocalActivities();
    return all
      .filter((a) => a.task_id === taskId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const { data, error } = await supabase
    .from('task_activities')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as ITaskActivity[];
}

export async function fetchBoardActivities(boardId: string): Promise<ITaskActivity[]> {
  if (!supabase) {
    const all = getLocalActivities();
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const { data, error } = await supabase
    .from('task_activities')
    .select('*, tasks!inner(board_id)')
    .eq('tasks.board_id', boardId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as ITaskActivity[];
}
