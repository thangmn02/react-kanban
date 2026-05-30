export type AuthMode = 'mock' | 'supabase';

export interface AppUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string;
  isMock: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  ownerId: string | null;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

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
