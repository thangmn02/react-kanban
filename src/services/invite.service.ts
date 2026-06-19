import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/supabase.type';
import type {
  WorkspaceInvite,
  WorkspaceInviteActionResult,
  WorkspaceInviteRole,
} from '../types/auth.type';

type WorkspaceInviteRow = Database['public']['Tables']['workspace_invites']['Row'];

interface WorkspaceInviteRpcPayload {
  status: WorkspaceInviteActionResult['status'];
  invite: WorkspaceInviteRow | null;
}

interface AcceptInviteRpcPayload {
  status: 'accepted' | 'already_accepted' | 'already_member';
  workspace_id: string;
}

const inviteSelectColumns = 'id,workspace_id,email,role,token,invited_by,accepted_at,expires_at,created_at';

function mapWorkspaceInvite(row: WorkspaceInviteRow): WorkspaceInvite {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invited_by,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function parseInviteActionPayload(data: unknown): WorkspaceInviteActionResult {
  const payload = data as Partial<WorkspaceInviteRpcPayload> | null;

  if (!payload || !payload.status) {
    throw new Error('Invite action returned an invalid response.');
  }

  return {
    status: payload.status,
    invite: payload.invite ? mapWorkspaceInvite(payload.invite) : null,
  };
}

function parseAcceptInvitePayload(data: unknown): AcceptInviteRpcPayload {
  const payload = data as Partial<AcceptInviteRpcPayload> | null;

  if (!payload?.workspace_id || !payload.status) {
    throw new Error('Invite acceptance returned an invalid response.');
  }

  return {
    status: payload.status,
    workspace_id: payload.workspace_id,
  };
}

export async function fetchWorkspaceInvites(workspaceId: string | null): Promise<WorkspaceInvite[]> {
  if (!supabase || !workspaceId) {
    return [];
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('workspace_invites')
    .select(inviteSelectColumns)
    .eq('workspace_id', workspaceId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapWorkspaceInvite);
}

export async function inviteWorkspaceMemberByEmail(
  workspaceId: string,
  email: string,
  role: WorkspaceInviteRole,
): Promise<WorkspaceInviteActionResult> {
  if (!supabase) {
    return {
      status: 'member_added',
      invite: null,
    };
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail) {
    throw new Error('Member email is required.');
  }

  const client = requireSupabaseClient();
  const { data, error } = await client.rpc('invite_workspace_member_by_email', {
    target_workspace_id: workspaceId,
    member_email: trimmedEmail,
    member_role: role,
  });

  if (error) {
    throw new Error(`${error.message}. Run docs/sql/workspace-invites.sql if this RPC is missing.`);
  }

  return parseInviteActionPayload(data);
}

export async function cancelWorkspaceInvite(inviteId: string): Promise<void> {
  if (!supabase) {
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchWorkspaceInviteByToken(token: string): Promise<WorkspaceInvite | null> {
  if (!supabase || !token) {
    return null;
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('workspace_invites')
    .select(inviteSelectColumns)
    .eq('token', token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapWorkspaceInvite(data) : null;
}

export async function acceptWorkspaceInvite(token: string): Promise<AcceptInviteRpcPayload> {
  if (!supabase) {
    throw new Error('Invite links require Supabase auth mode.');
  }

  const client = requireSupabaseClient();
  const { data, error } = await client.rpc('accept_workspace_invite', {
    invite_token: token,
  });

  if (error) {
    throw new Error(`${error.message}. Run docs/sql/workspace-invites.sql if this RPC is missing.`);
  }

  return parseAcceptInvitePayload(data);
}
