import { useCallback, useEffect } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

import type { AppUser, AuthMode, WorkspaceSummary } from '../types/auth.type';
import type { BoardViewMode } from '../hooks/useViewRouting';
import { authDestination, readReturnTo } from './auth-routing';
import type { useBoardPageController } from '../features/board/hooks/useBoardPageController';

type AppView = BoardViewMode | 'table' | 'arcana' | 'members' | 'contact' | 'music' | 'beat-grid' | 'focus';

export function deriveAppRouteState(pathname: string) {
  const boardMatch = matchPath('/workspaces/:workspaceId/boards/:boardId/*', pathname);
  const membersMatch = matchPath('/workspaces/:workspaceId/members', pathname);
  const inviteMatch = matchPath('/invite/:token', pathname);
  const activeView: AppView = matchPath('/contact', pathname)
    ? 'contact'
    : pathname.startsWith('/auth')
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
                    : ['/music', '/beat-grid', '/focus'].includes(pathname.replace(/\/$/, ''))
                      ? pathname.replace(/^\//, '').replace(/\/$/, '') as AppView
                    : boardMatch || matchPath('/tasks', pathname)
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
  const requireFeature = useCallback((destination: string) => {
    if (authMode === 'supabase' && !user) {
      navigate(authDestination(destination));
      return false;
    }
    if (authMode === 'supabase' && !activeWorkspaceId) {
      navigate(`/onboarding?${new URLSearchParams({ returnTo: destination })}`);
      return false;
    }
    return true;
  }, [authMode, user, activeWorkspaceId, navigate]);

  const goToView = useCallback(async (nextView: AppView, options?: { inviteToken?: string | null }) => {
    if (nextView === 'invite') {
      const token = options?.inviteToken || activeInviteToken;
      if (token) navigate(`/invite/${token}`);
      return;
    }
    if (nextView === 'auth') return navigate('/auth/sign-in');
    if (nextView === 'onboarding') return navigate('/onboarding');
    if (nextView === 'home') return navigate('/home');
    if (nextView === 'today') return navigate('/today');
    if (nextView === 'contact') return navigate('/contact');
    if (nextView === 'music' || nextView === 'beat-grid' || nextView === 'focus') return navigate(`/${nextView}`);
    if (nextView === 'arcana') return navigate('/arcana');
    if (nextView === 'members' && activeWorkspaceId) return navigate(`/workspaces/${activeWorkspaceId}/members`);
    if (nextView === 'not-found') return;
    if (authMode === 'supabase' && !user) return navigate(authDestination('/tasks'));
    if (!activeWorkspaceId) return navigate('/onboarding');
    let boardId = activeBoardId;
    // A direct public Contact visit deliberately has no loaded board yet.
    if (!boardId) {
      try {
        const boards = await refreshBoardList();
        boardId = boards.find(candidate => candidate.id === initialBoardId)?.id || boards[0]?.id || null;
      } catch { return navigate('/home'); }
    }
    if (!boardId) return navigate('/home');
    const suffix = nextView === 'calendar' ? '/calendar' : nextView === 'table' ? '/table' : '';
    return navigate(`/workspaces/${activeWorkspaceId}/boards/${boardId}${suffix}`);
  }, [activeBoardId, activeInviteToken, activeWorkspaceId, authMode, initialBoardId, navigate, refreshBoardList, user]);

  useEffect(() => {
    // Public pages and auth callbacks must never be redirected by workspace setup.
    if (activeView === 'contact') return;
    if (isAuthLoading || isWorkspaceLoading) return;
    if (activeView === 'auth') {
      if (authMode === 'mock') navigate(readReturnTo(location.search, location.state), { replace: true });
      return;
    }
    if (activeView === 'home' && (!user || !activeWorkspaceId)) { setIsBoardLoading(false); return; }
    if (activeView === 'not-found') {
      setIsBoardLoading(false);
      return;
    }
    if (authMode === 'mock' && ['auth', 'onboarding', 'invite'].includes(activeView)) {
      navigate('/home', { replace: true });
      return;
    }
    if (authMode === 'supabase' && !user && activeView !== 'invite') {
      navigate(authDestination(location.pathname + location.search + location.hash), { replace: true });
      return;
    }
    if (authMode === 'supabase' && user && !activeWorkspaceId && activeView !== 'invite') {
      if (activeView !== 'onboarding') navigate(`/onboarding?${new URLSearchParams({ returnTo: location.pathname + location.search + location.hash })}`, { replace: true });
      setIsBoardLoading(false);
      return;
    }
    if (authMode === 'supabase' && user && activeWorkspaceId && activeView === 'onboarding') {
      navigate(readReturnTo(location.search, location.state), { replace: true });
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
    location.pathname,
    location.search,
    location.hash,
    location.state,
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

  return { activeView, activeInviteToken, location, navigate, goToView, requireFeature };
}
