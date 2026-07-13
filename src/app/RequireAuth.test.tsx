import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import type { AppLayoutRouteContext } from './AppLayoutRouteContext';
import RequireAuth from './RequireAuth';

const authValue: AuthContextValue = {
  authMode: 'mock',
  user: null,
  session: null,
  isAuthLoading: false,
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: vi.fn(),
};

function ParentLayout() {
  return <Outlet context={{ marker: 'layout-context' } as unknown as AppLayoutRouteContext} />;
}

function ContextProbe() {
  const context = useOutletContext<AppLayoutRouteContext & { marker: string }>();
  return <div>{context.marker}</div>;
}

describe('RequireAuth', () => {
  it('forwards the layout outlet context to protected route modules', () => {
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route element={<ParentLayout />}>
              <Route element={<RequireAuth />}>
                <Route path="home" element={<ContextProbe />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText('layout-context')).toBeInTheDocument();
  });
});
