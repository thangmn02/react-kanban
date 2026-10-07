import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deriveAppRouteState, useAppRoutingController } from './useAppRoutingController';

const routing = vi.hoisted(() => ({ navigate: vi.fn(), location: { pathname: '/contact', search: '', hash: '' } }));
vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(),
  useNavigate: () => routing.navigate,
  useLocation: () => routing.location,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); routing.location = { pathname: '/contact', search: '', hash: '' }; });

describe('navigation from a direct Contact visit', () => {
  function setup(signedIn = true, initialBoardId: string | null = null) {
    const refreshBoardList = vi.fn().mockResolvedValue([{ id: 'first-board' }, { id: 'saved-board' }]);
    const board = { activeBoardId: null, initialBoardId, refreshBoardList,
      refreshBoardData: vi.fn(), setIsBoardLoading: vi.fn() } as unknown as Parameters<typeof useAppRoutingController>[0]['board'];
    const { result } = renderHook(() => useAppRoutingController({ authMode: 'supabase',
      user: signedIn ? { id: 'user', name: 'Reader', email: null, avatarUrl: '', isMock: false } : null,
      isAuthLoading: false, isWorkspaceLoading: false, activeWorkspaceId: 'workspace',
      workspaces: [], setActiveWorkspaceId: vi.fn(), board }));
    return { result, refreshBoardList, board };
  }
  it('opens a real board without needing an intermediate Home visit', async () => {
    const { result, refreshBoardList, board } = setup();
    expect(board.refreshBoardData).not.toHaveBeenCalled();
    await act(async () => { await result.current.goToView('board'); });
    expect(refreshBoardList).toHaveBeenCalledOnce();
    expect(routing.navigate).toHaveBeenCalledWith('/workspaces/workspace/boards/first-board');
  });
  it('uses the remembered board when it still belongs to the workspace', async () => {
    const { result } = setup(true, 'saved-board');
    await act(async () => { await result.current.goToView('board'); });
    expect(routing.navigate).toHaveBeenCalledWith('/workspaces/workspace/boards/saved-board');
  });
  it('routes signed-out visitors to sign-in without loading private boards', async () => {
    const { result, refreshBoardList } = setup(false);
    await act(async () => { await result.current.goToView('board'); });
    expect(refreshBoardList).not.toHaveBeenCalled();
    expect(routing.navigate).toHaveBeenCalledWith('/auth/sign-in?returnTo=%2Ftasks');
  });
  it('leaves guest Home public without fetching private boards', () => {
    routing.location.pathname = '/';
    const { board, refreshBoardList } = setup(false);
    expect(routing.navigate).not.toHaveBeenCalled();
    expect(refreshBoardList).not.toHaveBeenCalled();
    expect(board.refreshBoardData).not.toHaveBeenCalled();
  });
  it('leaves authenticated auth callbacks in control of their feature destination', () => {
    routing.location = { pathname: '/auth/sign-in', search: '?returnTo=%2Fbeat-grid', hash: '' };
    const { refreshBoardList } = setup();
    expect(routing.navigate).not.toHaveBeenCalled();
    expect(refreshBoardList).not.toHaveBeenCalled();
  });
  it('uses the preserved feature after a workspace becomes available', () => {
    routing.location = { pathname: '/onboarding', search: '?returnTo=%2Fbeat-grid', hash: '' };
    setup();
    expect(routing.navigate).toHaveBeenCalledWith('/beat-grid', { replace: true });
  });
});

describe('deriveAppRouteState', () => {
  it.each([
    ['/home', 'home'],
    ['/', 'home'],
    ['/tasks', 'board'],
    ['/music', 'music'],
    ['/beat-grid', 'beat-grid'],
    ['/focus', 'focus'],
    ['/today', 'today'],
    ['/contact', 'contact'],
    ['/contact/', 'contact'],
    ['/contact/unknown', 'not-found'],
    ['/arcana', 'arcana'],
    ['/auth/sign-in', 'auth'],
    ['/onboarding', 'onboarding'],
    ['/workspaces/w1/members', 'members'],
    ['/workspaces/w1/boards/b1', 'board'],
    ['/workspaces/w1/boards/b1/calendar', 'calendar'],
    ['/workspaces/w1/boards/b1/table', 'table'],
    ['/missing', 'not-found'],
  ])('maps %s to %s', (pathname, expectedView) => {
    expect(deriveAppRouteState(pathname).activeView).toBe(expectedView);
  });

  it('extracts validated-route candidates from board URLs', () => {
    expect(deriveAppRouteState('/workspaces/workspace-1/boards/board-2/table')).toMatchObject({
      routeWorkspaceId: 'workspace-1',
      routeBoardId: 'board-2',
      activeView: 'table',
    });
  });

  it('extracts invite tokens without treating arbitrary paths as invites', () => {
    expect(deriveAppRouteState('/invite/token-123').activeInviteToken).toBe('token-123');
    expect(deriveAppRouteState('/home').activeInviteToken).toBeNull();
  });
});
