import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createWorkspaceForCurrentUser,
  ensureUserProfile,
  fetchUserWorkspaces,
} from '../services/workspace.service';
import type { AppUser, WorkspaceSummary } from '../types/auth.type';
import { readScopedJSON, writeScopedJSON, type StorageScope } from '../shared/storage/storageAdapter';

function buildUserScope(user: AppUser | null): StorageScope {
  return { userId: user?.id ?? 'mock-user', workspaceId: null };
}

export function useWorkspaceSession(user: AppUser | null) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return readScopedJSON<string | null>(buildUserScope(user), 'active_workspace', null);
  });
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceErrorMessage, setWorkspaceErrorMessage] = useState<string | null>(null);

  const activeWorkspace = useMemo(() => (
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || null
  ), [activeWorkspaceId, workspaces]);

  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setIsWorkspaceLoading(false);
      return;
    }

    setIsWorkspaceLoading(true);

    try {
      await ensureUserProfile(user);
      const nextWorkspaces = await fetchUserWorkspaces(user);
      const storedWorkspaceId = readScopedJSON<string | null>(buildUserScope(user), 'active_workspace', null);
      const nextActiveWorkspace = nextWorkspaces.find((workspace) => workspace.id === storedWorkspaceId)
        || nextWorkspaces[0]
        || null;

      setWorkspaces(nextWorkspaces);
      setActiveWorkspaceId(nextActiveWorkspace?.id || null);
      setWorkspaceErrorMessage(null);
    } catch (error) {
      setWorkspaceErrorMessage(error instanceof Error ? error.message : 'Unable to load workspaces.');
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    const scope = buildUserScope(user);
    if (activeWorkspace?.id) {
      writeScopedJSON(scope, 'active_workspace', activeWorkspace.id);
    } else {
      writeScopedJSON(scope, 'active_workspace', null);
    }
  }, [activeWorkspace?.id, user]);

  const createWorkspace = useCallback(async (workspaceName: string) => {
    const createdWorkspace = await createWorkspaceForCurrentUser(workspaceName);

    setWorkspaces((currentWorkspaces) => {
      const hasWorkspace = currentWorkspaces.some((workspace) => workspace.id === createdWorkspace.id);
      return hasWorkspace ? currentWorkspaces : [...currentWorkspaces, createdWorkspace];
    });
    setActiveWorkspaceId(createdWorkspace.id);
    setWorkspaceErrorMessage(null);

    return createdWorkspace;
  }, []);

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || null,
    isWorkspaceLoading,
    workspaceErrorMessage,
    setActiveWorkspaceId,
    reloadWorkspaces: loadWorkspaces,
    createWorkspace,
  };
}
