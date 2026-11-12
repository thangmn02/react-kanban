import { isLocalDemoMode, requireSupabaseClient } from '../lib/supabase';
import type { AppUser } from '../types/auth.type';
import type { FollowUpRemote, WaitingOn } from '../features/today/task-followups';

/** The account side of "Waiting on", or null when there is no account to sync with. */
export function taskFollowUpRemote(user: AppUser, workspaceId: string | null): FollowUpRemote | null {
  if (isLocalDemoMode || user.isMock || !workspaceId) return null;
  const failed = (error: { message: string; code?: string }) => Object.assign(Error(error.message), { code: error.code });
  return {
    async list() {
      const { data, error } = await requireSupabaseClient().rpc('list_task_follow_ups', { target_workspace_id: workspaceId });
      if (error) throw failed(error);
      return Array.isArray(data) ? data as unknown as Array<{ taskId: string } & WaitingOn> : [];
    },
    async set(taskId, change) {
      const { error } = await requireSupabaseClient().rpc('set_task_follow_up', { request: { actorUserId: user.id, taskId, ...change } });
      if (error) throw failed(error);
    },
  };
}
