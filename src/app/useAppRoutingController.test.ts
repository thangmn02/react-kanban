import { describe, expect, it } from 'vitest';

import { deriveAppRouteState } from './useAppRoutingController';

describe('deriveAppRouteState', () => {
  it.each([
    ['/home', 'home'],
    ['/today', 'today'],
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
