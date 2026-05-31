import { useCallback, useEffect, useState } from 'react';

import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../services/workspace.service';
import {
  cancelWorkspaceInvite,
  fetchWorkspaceInvites,
  inviteWorkspaceMemberByEmail,
} from '../services/invite.service';
import type {
  WorkspaceInvite,
  WorkspaceInviteActionResult,
  WorkspaceInviteRole,
  WorkspaceMember,
  WorkspaceRole,
} from '../types/auth.type';
import { mockWorkspaceMembers } from '../utils/workspaceMembers';

interface UseWorkspaceMembersResult {
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  isLoadingMembers: boolean;
  memberErrorMessage: string | null;
  addMember: (email: string, role: WorkspaceInviteRole) => Promise<WorkspaceInviteActionResult>;
  changeMemberRole: (membershipId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  reloadMembers: () => Promise<void>;
}

export function useWorkspaceMembers(workspaceId: string | null): UseWorkspaceMembersResult {
  const [members, setMembers] = useState<WorkspaceMember[]>(mockWorkspaceMembers);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberErrorMessage, setMemberErrorMessage] = useState<string | null>(null);

  const reloadMembers = useCallback(async () => {
    setIsLoadingMembers(true);

    try {
      const [nextMembers, nextInvites] = await Promise.all([
        fetchWorkspaceMembers(workspaceId),
        fetchWorkspaceInvites(workspaceId),
      ]);

      setMembers(nextMembers);
      setInvites(nextInvites);
      setMemberErrorMessage(null);
    } catch (error) {
      setMemberErrorMessage(error instanceof Error ? error.message : 'Unable to load workspace members.');
    } finally {
      setIsLoadingMembers(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

  const addMember = useCallback(async (email: string, role: WorkspaceInviteRole) => {
    if (!workspaceId) {
      throw new Error('Select a workspace before adding members.');
    }

    const result = await inviteWorkspaceMemberByEmail(workspaceId, email, role);
    await reloadMembers();

    return result;
  }, [reloadMembers, workspaceId]);

  const changeMemberRole = useCallback(async (membershipId: string, role: WorkspaceRole) => {
    await updateWorkspaceMemberRole(membershipId, role);
    await reloadMembers();
  }, [reloadMembers]);

  const removeMember = useCallback(async (membershipId: string) => {
    await removeWorkspaceMember(membershipId);
    await reloadMembers();
  }, [reloadMembers]);

  const cancelInvite = useCallback(async (inviteId: string) => {
    await cancelWorkspaceInvite(inviteId);
    await reloadMembers();
  }, [reloadMembers]);

  return {
    members,
    invites,
    isLoadingMembers,
    memberErrorMessage,
    addMember,
    changeMemberRole,
    removeMember,
    cancelInvite,
    reloadMembers,
  };
}
