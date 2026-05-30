import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { AppUser, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '../types/auth.type';
import { mockWorkspaceMembers } from '../utils/workspaceMembers';

const localWorkspace: WorkspaceSummary = {
  id: 'local-mock-workspace',
  name: 'Local Workspace',
  role: 'owner',
  ownerId: 'mock-user',
};

interface WorkspaceMembershipRow {
  role: string;
  workspace_id: string;
  workspaces: {
    id: string;
    name: string;
    owner_id: string | null;
  } | null;
}

interface WorkspaceMemberRow {
  id: string;
  role: WorkspaceRole;
  user_id: string;
  workspace_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const fallbackAvatarUrl = 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png';

function normalizeWorkspaceRole(role: string): WorkspaceRole {
  return ['owner', 'admin', 'member', 'viewer'].includes(role)
    ? role as WorkspaceRole
    : 'member';
}

function mapWorkspaceMemberRows(
  members: WorkspaceMemberRow[],
  profiles: ProfileRow[],
): WorkspaceMember[] {
  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));

  return members.map((member) => {
    const profile = profileByUserId.get(member.user_id);
    const name = profile?.full_name || profile?.email || 'Workspace member';

    return {
      id: member.id,
      userId: member.user_id,
      workspaceId: member.workspace_id,
      role: normalizeWorkspaceRole(member.role),
      name,
      email: profile?.email || null,
      avatarUrl: profile?.avatar_url || fallbackAvatarUrl,
      createdAt: member.created_at,
    };
  });
}

export async function ensureUserProfile(user: AppUser): Promise<void> {
  if (!supabase || user.isMock) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: user.name,
      avatar_url: user.avatarUrl,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export async function fetchUserWorkspaces(user: AppUser | null): Promise<WorkspaceSummary[]> {
  if (!supabase || !user || user.isMock) {
    return [localWorkspace];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('workspace_members')
    .select('role,workspace_id,workspaces(id,name,owner_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as unknown as WorkspaceMembershipRow[])
    .flatMap((membership) => {
      if (!membership.workspaces) {
        return [];
      }

      return [{
        id: membership.workspaces.id,
        name: membership.workspaces.name,
        ownerId: membership.workspaces.owner_id,
        role: normalizeWorkspaceRole(membership.role),
      }];
    });
}

export async function createWorkspaceForCurrentUser(workspaceName: string): Promise<WorkspaceSummary> {
  if (!supabase) {
    return {
      ...localWorkspace,
      name: workspaceName,
    };
  }

  const client = requireSupabaseClient();
  const trimmedWorkspaceName = workspaceName.trim();

  if (!trimmedWorkspaceName) {
    throw new Error('Workspace name is required.');
  }

  const rpc = client.rpc as unknown as (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: string | null; error: Error | null }>;

  const { data: workspaceId, error } = await rpc('create_workspace_with_owner', {
    workspace_name: trimmedWorkspaceName,
  });

  if (error) {
    throw new Error(
      `${error.message}. Run the create_workspace_with_owner SQL helper if this RPC is missing.`
    );
  }

  if (!workspaceId) {
    throw new Error('Workspace was not created.');
  }

  return {
    id: workspaceId,
    name: trimmedWorkspaceName,
    role: 'owner',
    ownerId: null,
  };
}

export async function fetchWorkspaceMembers(workspaceId: string | null): Promise<WorkspaceMember[]> {
  if (!supabase || !workspaceId) {
    return mockWorkspaceMembers;
  }

  const client = requireSupabaseClient();
  const { data: members, error: membersError } = await client
    .from('workspace_members')
    .select('id,role,user_id,workspace_id,created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (membersError) {
    throw membersError;
  }

  const memberRows = (members || []) as WorkspaceMemberRow[];
  const userIds = memberRows.map((member) => member.user_id);

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id,email,full_name,avatar_url')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  return mapWorkspaceMemberRows(memberRows, (profiles || []) as ProfileRow[]);
}

export async function addWorkspaceMemberByEmail(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
): Promise<void> {
  if (!supabase) {
    return;
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail) {
    throw new Error('Member email is required.');
  }

  const client = requireSupabaseClient();
  const rpc = client.rpc as unknown as (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: string | null; error: Error | null }>;

  const { error } = await rpc('add_workspace_member_by_email', {
    target_workspace_id: workspaceId,
    member_email: trimmedEmail,
    member_role: role,
  });

  if (error) {
    throw new Error(
      `${error.message}. Run the Phase 4 workspace member SQL helper if this RPC is missing.`
    );
  }
}

export async function updateWorkspaceMemberRole(
  membershipId: string,
  role: WorkspaceRole,
): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('workspace_members')
    .update({ role })
    .eq('id', membershipId);

  if (error) {
    throw error;
  }
}

export async function removeWorkspaceMember(membershipId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('workspace_members')
    .delete()
    .eq('id', membershipId);

  if (error) {
    throw error;
  }
}
