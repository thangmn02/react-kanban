import { requireSupabaseClient } from '../lib/supabase';
import type { AppUser } from '../types/auth.type';
import { fetchDailyFocusStats } from './focusSession.service';
import { fetchTasks } from './task.service';

export interface IdentitySummary {
  focusSessions: number | null;
  focusedMinutes: number | null;
  completedTasks: number | null;
  joinedAt: string | null;
  unavailable: boolean;
}
export const emptyIdentitySummary: IdentitySummary = { focusSessions: null, focusedMinutes: null, completedTasks: null, joinedAt: null, unavailable: false };

/** Read only the current account/workspace. Missing data stays unavailable, not zero. */
export async function fetchIdentitySummary(user: AppUser, workspaceId: string | null): Promise<IdentitySummary> {
  if (!workspaceId) return { ...emptyIdentitySummary };
  const client = user.isMock ? null : requireSupabaseClient();
  const assertAccount = async () => {
    if (client && (await client.auth.getSession()).data.session?.user.id !== user.id) throw Error('The account changed. Reopen your profile.');
  };
  await assertAccount();
  const [focus, tasks, membership] = await Promise.allSettled([
    fetchDailyFocusStats(workspaceId, user.id),
    client ? client.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_done', true).is('deleted_at', null).is('archived_at', null).then(result => {
      if (result.error) throw result.error;
      return result.count;
    }) : fetchTasks({ workspaceId }).then(rows => rows.filter(row => row.is_done && !row.deleted_at && !row.archived_at).length),
    client ? client.from('workspace_members').select('created_at').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle().then(result => {
      if (result.error) throw result.error;
      return result.data?.created_at ?? null;
    }) : Promise.resolve(null),
  ]);
  await assertAccount();
  return {
    focusSessions: focus.status === 'fulfilled' ? focus.value.completedSessions : null,
    focusedMinutes: focus.status === 'fulfilled' ? focus.value.focusedMinutes : null,
    completedTasks: tasks.status === 'fulfilled' ? tasks.value : null,
    joinedAt: membership.status === 'fulfilled' ? membership.value : null,
    unavailable: [focus, tasks, membership].some(result => result.status === 'rejected') || tasks.status === 'fulfilled' && tasks.value === null,
  };
}
