import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { AuthMode } from '../../types/auth.type';
import UserMenu from './UserMenu';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it.each<AuthMode>(['mock', 'supabase'])('hides Arcana and reward badges in the %s account menu', (authMode) => {
  const onOpenArcanaBooth = vi.fn();
  const onSignOut = vi.fn();
  render(<I18nProvider><UserMenu user={{ id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: authMode === 'mock' }} authMode={authMode} activeWorkspace={null} onSignOut={onSignOut} onOpenArcanaBooth={onOpenArcanaBooth} arcanaAvailableDraws={5} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(screen.getByLabelText('Language')).toBeVisible();
  expect(screen.queryByRole('menuitem', { name: /Arcana/i })).not.toBeInTheDocument();
  expect(onOpenArcanaBooth).not.toHaveBeenCalled();
  if (authMode === 'supabase') {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  }
});
