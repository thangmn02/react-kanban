import { useCallback, useEffect, useState } from 'react';

import {
  addWorkspaceMemberByEmail,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../services/workspace.service';
import type { WorkspaceMember, WorkspaceRole } from '../types/auth.type';
import { mockWorkspaceMembers } from '../utils/workspaceMembers';

interface UseWorkspaceMembersResult {
  members: WorkspaceMember[];
  isLoadingMembers: boolean;
  memberErrorMessage: string | null;
  addMember: (email: string, role: WorkspaceRole) => Promise<void>;
  changeMemberRole: (membershipId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  reloadMembers: () => Promise<void>;
}

export function useWorkspaceMembers(workspaceId: string | null): UseWorkspaceMembersResult {
  const [members, setMembers] = useState<WorkspaceMember[]>(mockWorkspaceMembers);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberErrorMessage, setMemberErrorMessage] = useState<string | null>(null);

  const reloadMembers = useCallback(async () => {
    setIsLoadingMembers(true);

    try {
      const nextMembers = await fetchWorkspaceMembers(workspaceId);
      setMembers(nextMembers);
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

  const addMember = useCallback(async (email: string, role: WorkspaceRole) => {
    if (!workspaceId) {
      throw new Error('Select a workspace before adding members.');
    }

    await addWorkspaceMemberByEmail(workspaceId, email, role);
    await reloadMembers();
  }, [reloadMembers, workspaceId]);

  const changeMemberRole = useCallback(async (membershipId: string, role: WorkspaceRole) => {
    await updateWorkspaceMemberRole(membershipId, role);
    await reloadMembers();
  }, [reloadMembers]);

  const removeMember = useCallback(async (membershipId: string) => {
    await removeWorkspaceMember(membershipId);
    await reloadMembers();
  }, [reloadMembers]);

  return {
    members,
    isLoadingMembers,
    memberErrorMessage,
    addMember,
    changeMemberRole,
    removeMember,
    reloadMembers,
  };
}
