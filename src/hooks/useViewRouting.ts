import { useCallback, useEffect, useState } from 'react';

import type { BoardTabId } from '../components/board/BoardTabs';

export type BoardViewMode = 'auth' | 'onboarding' | 'invite' | 'home' | 'today' | 'board' | 'calendar' | 'not-found';

export interface UseViewRoutingResult {
  activeView: BoardViewMode;
  activeInviteToken: string | null;
  activeBoardTab: BoardTabId;
  setActiveViewWithPath: (view: BoardViewMode, options?: { inviteToken?: string | null }) => void;
  setActiveInviteToken: (token: string | null) => void;
}

const getInitialView = (): BoardViewMode => {
  if (typeof window === 'undefined') {
    return 'home';
  }

  if (window.location.pathname.startsWith('/auth')) {
    return 'auth';
  }

  if (window.location.pathname.startsWith('/onboarding')) {
    return 'onboarding';
  }

  if (window.location.pathname.startsWith('/invite/')) {
    return 'invite';
  }

  if (window.location.pathname.startsWith('/today') || window.location.pathname.startsWith('/my-day')) {
    return 'today';
  }

  if (window.location.pathname.startsWith('/board')) {
    return 'board';
  }

  if (window.location.pathname.startsWith('/calendar')) {
    return 'calendar';
  }

  // Root and the canonical dashboard path map to home; anything else that is
  // not a known route is treated as not-found (catch-all).
  if (window.location.pathname === '/' || window.location.pathname.startsWith('/home')) {
    return 'home';
  }

  return 'not-found';
};

const getInviteTokenFromPath = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const [, invitePath, token] = window.location.pathname.split('/');
  return invitePath === 'invite' && token ? token : null;
};

export function useViewRouting(): UseViewRoutingResult {
  const [activeView, setActiveView] = useState<BoardViewMode>(() => getInitialView());
  const [activeInviteToken, setActiveInviteToken] = useState<string | null>(() => getInviteTokenFromPath());
  const activeBoardTab: BoardTabId = activeView === 'calendar' ? 'calendar' : 'board';

  const setActiveViewWithPath = useCallback((nextView: BoardViewMode, options?: { inviteToken?: string | null }) => {
    setActiveView(nextView);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextView === 'invite') {
      const nextInviteToken = options?.inviteToken ?? activeInviteToken;
      setActiveInviteToken(nextInviteToken || null);

      if (!nextInviteToken) {
        return;
      }

      const nextPath = `/invite/${nextInviteToken}`;

      if (window.location.pathname !== nextPath) {
        window.history.pushState({ view: nextView }, '', nextPath);
      }

      return;
    }

    const nextPath = nextView === 'home'
      ? '/home'
      : nextView === 'auth'
        ? '/auth'
        : nextView === 'onboarding'
          ? '/onboarding'
      : nextView === 'today'
        ? '/today'
      : nextView === 'calendar'
        ? '/calendar'
        : '/board';

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ view: nextView }, '', nextPath);
    }
  }, [activeInviteToken]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveInviteToken(getInviteTokenFromPath());
      setActiveView(getInitialView());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    activeView,
    activeInviteToken,
    activeBoardTab,
    setActiveViewWithPath,
    setActiveInviteToken,
  };
}
