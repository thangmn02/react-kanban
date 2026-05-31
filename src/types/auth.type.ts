export type AuthMode = 'mock' | 'supabase';

export interface AppUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string;
  isMock: boolean;
}

export interface AuthActionResult {
  requiresEmailConfirmation: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  ownerId: string | null;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WorkspaceInviteRole = Exclude<WorkspaceRole, 'owner'>;

export type WorkspaceInviteStatus = 'member_added' | 'invite_created' | 'invite_existing';

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  name: string;
  email: string | null;
  avatarUrl: string;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceInviteRole;
  token: string;
  invitedBy: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceInviteActionResult {
  status: WorkspaceInviteStatus;
  invite: WorkspaceInvite | null;
}
