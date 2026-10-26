import { AVAILABLE_ASSIGNEES } from '../data/assignees';
import type { WorkspaceMember } from '../types/auth.type';
import type { TaskAssignee } from '../types/task.type';

export const mockWorkspaceMembers: WorkspaceMember[] = AVAILABLE_ASSIGNEES.map((assignee, index) => ({
  id: `mock-member-${index}`,
  userId: index === 0 ? 'mock-user' : `mock-user-${index}`,
  workspaceId: 'local-mock-workspace',
  role: index === 0 ? 'owner' : 'member',
  name: assignee.name,
  email: index === 0 ? 'bonnie@example.com' : null,
  avatarUrl: assignee.avatar,
  createdAt: new Date(0).toISOString(),
}));

export function mapWorkspaceMemberToAssignee(member: WorkspaceMember): TaskAssignee {
  return {
    name: member.name,
    avatar: member.avatarUrl,
    // Propagate stable identity so newly-assigned mock tasks match by id.
    userId: member.userId,
    workspaceMemberId: member.id,
  };
}

export function mapWorkspaceMembersToAssignees(members: WorkspaceMember[]): TaskAssignee[] {
  return members.map(mapWorkspaceMemberToAssignee);
}

export function resolveAssigneeIdentity(assignee:TaskAssignee,members:WorkspaceMember[]):TaskAssignee {
  const matches=members.filter(member=>assignee.userId ? member.userId===assignee.userId : assignee.workspaceMemberId ? member.id===assignee.workspaceMemberId
    : member.name===assignee.name || member.previousNames?.includes(assignee.name));
  return matches.length===1 ? {...assignee,name:matches[0].name,avatar:matches[0].avatarUrl} : assignee;
}

export function getWorkspaceMemberDisplayName(member: Pick<WorkspaceMember, 'name' | 'email'>) {
  return member.name || member.email || 'Workspace member';
}

export function sameAssigneeIdentity(a:TaskAssignee,b:TaskAssignee):boolean {
  if(a.userId&&b.userId)return a.userId===b.userId;
  if(a.workspaceMemberId&&b.workspaceMemberId)return a.workspaceMemberId===b.workspaceMemberId;
  return a.name===b.name;
}
