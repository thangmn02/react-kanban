import { useCallback, useEffect } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

import type { AppUser, AuthMode, WorkspaceSummary } from '../types/auth.type';
import type { BoardViewMode } from '../hooks/useViewRouting';
import type { useBoardPageController } from '../features/board/hooks/useBoardPageController';

type AppView = BoardViewMode | 'table' | 'arcana' | 'members';

export function deriveAppRouteState(pathname: string) {
  const boardMatch = matchPath('/workspaces/:workspaceId/boards/:boardId/*', pathname);
  const membersMatch = matchPath('/workspaces/:workspaceId/members', pathname);
  const inviteMatch = matchPath('/invite/:token', pathname);
  const activeView: AppView = pathname.startsWith('/auth')
    ? 'auth'
    : pathname.startsWith('/onboarding')
      ? 'onboarding'
      : pathname.startsWith('/invite/')
        ? 'invite'
        : pathname.startsWith('/today')
          ? 'today'
          : pathname.startsWith('/home') || pathname === '/'
            ? 'home'
            : pathname.startsWith('/arcana')
              ? 'arcana'
              : pathname.endsWith('/calendar')
                ? 'calendar'
                : pathname.endsWith('/table')
                  ? 'table'
                  : boardMatch
                    ? 'board'
                    : membersMatch
                      ? 'members'
                      : 'not-found';
  return {
    activeView,
    activeInviteToken: inviteMatch?.params.token || null,
    routeWorkspaceId: boardMatch?.params.workspaceId || membersMatch?.params.workspaceId || null,
    routeBoardId: boardMatch?.params.boardId || null,
  };
}

interface Params {
  authMode: AuthMode;
  user: AppUser | null;
  isAuthLoading: boolean;
  isWorkspaceLoading: boolean;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  board: ReturnType<typeof useBoardPageController>;
}

export function useAppRoutingController({
  authMode,
  user,
  isAuthLoading,
  isWorkspaceLoading,
  activeWorkspaceId,
  workspaces,
  setActiveWorkspaceId,
  board,
}: Params) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeBoardId,
    initialBoardId,
    refreshBoardData,
    refreshBoardList,
    setIsBoardLoading,
  } = board;
  const { activeView, activeInviteToken, routeWorkspaceId, routeBoardId } = deriveAppRouteState(location.pathname);

  const goToView = useCallback((nextView: AppView, options?: { inviteToken?: string | null }) => {
    if (nextView === 'invite') {
      const token = options?.inviteToken || activeInviteToken;
      if (token) navigate(`/invite/${token}`);
      return;
    }
    if (nextView === 'auth') return navigate('/auth/sign-in');
    if (nextView === 'onboarding') return navigate('/onboarding');
    if (nextView === 'home') return navigate('/home');
    if (nextView === 'today') return navigate('/today');
    if (nextView === 'arcana') return navigate('/arcana');
    if (nextView === 'members' && activeWorkspaceId) return navigate(`/workspaces/${activeWorkspaceId}/members`);
    if (nextView === 'not-found') return;
    if (activeWorkspaceId && activeBoardId) {
      const suffix = nextView === 'calendar' ? '/calendar' : nextView === 'table' ? '/table' : '';
      navigate(`/workspaces/${activeWorkspaceId}/boards/${activeBoardId}${suffix}`);
    }
  }, [activeBoardId, activeInviteToken, activeWorkspaceId, navigate]);

  useEffect(() => {
    if (isAuthLoading || isWorkspaceLoading) return;
    if (activeView === 'not-found') {
      setIsBoardLoading(false);
      return;
    }
    if (authMode === 'mock' && ['auth', 'onboarding', 'invite'].includes(activeView)) {
      navigate('/home', { replace: true });
      return;
    }
    if (authMode === 'supabase' && !user && activeView !== 'invite') {
      navigate('/auth/sign-in', { replace: true });
      return;
    }
    if (authMode === 'supabase' && user && !activeWorkspaceId && activeView !== 'invite') {
      navigate('/onboarding', { replace: true });
      setIsBoardLoading(false);
      return;
    }
    if (authMode === 'supabase' && user && activeWorkspaceId && (activeView === 'auth' || activeView === 'onboarding')) {
      navigate('/home', { replace: true });
      return;
    }
    if (activeView === 'invite') {
      setIsBoardLoading(false);
      return;
    }
    if (routeWorkspaceId && routeWorkspaceId !== activeWorkspaceId) {
      if (!workspaces.some((workspace) => workspace.id === routeWorkspaceId)) {
        navigate('/not-found', { replace: true });
        return;
      }
      setActiveWorkspaceId(routeWorkspaceId);
      setIsBoardLoading(true);
      return;
    }
    void (async () => {
      const boards = await refreshBoardList();
      if (routeBoardId && !boards.some((candidate) => candidate.id === routeBoardId)) {
        navigate('/not-found', { replace: true });
        setIsBoardLoading(false);
        return;
      }
      await refreshBoardData({ boardId: routeBoardId || initialBoardId });
    })();
  }, [
    activeView,
    activeWorkspaceId,
    authMode,
    initialBoardId,
    refreshBoardData,
    refreshBoardList,
    setIsBoardLoading,
    isAuthLoading,
    isWorkspaceLoading,
    navigate,
    routeBoardId,
    routeWorkspaceId,
    setActiveWorkspaceId,
    user,
    workspaces,
  ]);

  return { activeView, activeInviteToken, location, navigate, goToView };
}
