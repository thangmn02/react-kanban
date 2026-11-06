import { render as renderBare, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from '../../i18n';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
const render = (ui: ReactElement) => renderBare(ui, { wrapper: I18nProvider });

const authValue = (overrides: Partial<AuthContextValue>): AuthContextValue => ({
  authMode: 'supabase',
  user: null,
  session: null,
  isAuthLoading: false,
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: vi.fn(),
  ...overrides,
});

describe('ProtectedRoute authentication redirects', () => {
  it('requests the auth surface after a Supabase session check finds no user', async () => {
    const onRequireAuth = vi.fn();
    render(
      <AuthContext.Provider value={authValue({})}>
        <ProtectedRoute onRequireAuth={onRequireAuth}><div>Private</div></ProtectedRoute>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    await waitFor(() => expect(onRequireAuth).toHaveBeenCalledTimes(1));
  });

  it('keeps the loading surface until authentication resolves', () => {
    const onRequireAuth = vi.fn();
    render(
      <AuthContext.Provider value={authValue({ isAuthLoading: true })}>
        <ProtectedRoute onRequireAuth={onRequireAuth}><div>Private</div></ProtectedRoute>
      </AuthContext.Provider>,
    );
    expect(screen.getByText('Checking session...')).toBeInTheDocument();
    expect(onRequireAuth).not.toHaveBeenCalled();
  });

  it('renders protected content for mock mode without redirecting', () => {
    const onRequireAuth = vi.fn();
    render(
      <AuthContext.Provider value={authValue({ authMode: 'mock' })}>
        <ProtectedRoute onRequireAuth={onRequireAuth}><div>Private</div></ProtectedRoute>
      </AuthContext.Provider>,
    );
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(onRequireAuth).not.toHaveBeenCalled();
  });
});
