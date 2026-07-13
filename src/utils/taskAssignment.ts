import type { AppUser } from '../types/auth.type';
import type { TaskAssignee } from '../types/task.type';

/**
 * Determines whether a task is assigned to the current user using **stable
 * identity** (`assignee.userId === currentUser.id`) whenever a stable id is
 * available on both sides.
 *
 * For legacy/seed assignees that carry no `userId` (e.g. the original demo
 * data), it falls back to display-name/email comparison so those tasks are not
 * silently dropped. This keeps the local demo working while ensuring that two
 * real Supabase users who happen to share a display name no longer collide.
 *
 * Use `workspaceMemberId` (not this helper) when an operation concerns
 * membership/role rather than global user identity — name and avatar are
 * display-only metadata here.
 */
export function isTaskAssignedToUser(
  assignees: TaskAssignee[],
  currentUser: AppUser | null,
): boolean {
  if (!currentUser) {
    return false;
  }

  return assignees.some((assignee) => {
    if (assignee.userId && currentUser.id) {
      return assignee.userId === currentUser.id;
    }

    // Legacy fallback: no stable id on the assignee.
    return (
      assignee.name === currentUser.name
      || (currentUser.email != null && assignee.name === currentUser.email)
    );
  });
}
