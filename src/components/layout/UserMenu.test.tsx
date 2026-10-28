import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { AuthMode } from '../../types/auth.type';
import UserMenu from './UserMenu';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it.each<AuthMode>(['mock', 'supabase'])('hides Arcana and reward badges in the %s account menu', async (authMode) => {
  const onOpenArcanaBooth = vi.fn();
  const onSignOut = vi.fn();
  render(<MemoryRouter><I18nProvider><UserMenu user={{ id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: authMode === 'mock' }} authMode={authMode} activeWorkspace={null} onSignOut={onSignOut} onOpenArcanaBooth={onOpenArcanaBooth} arcanaAvailableDraws={5} /></I18nProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  await waitFor(()=>expect(screen.getByLabelText('Language')).toBeVisible());
  expect(screen.queryByRole('menuitem', { name: /Arcana/i })).not.toBeInTheDocument();
  expect(onOpenArcanaBooth).not.toHaveBeenCalled();
  if (authMode === 'supabase') {
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
  }
});

it('retains the exact long email while constraining its displayed lines', async () => {
  const email = 'qualification-account-with-a-very-long-generated-identifier@example.invalid';
  render(<MemoryRouter><I18nProvider><UserMenu user={{ id: 'user', name: 'Alex', email, avatarUrl: '', isMock: true }} authMode="mock" activeWorkspace={null} onSignOut={vi.fn()} onOpenArcanaBooth={vi.fn()} /></I18nProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  const address = await screen.findByText(email);
  expect(address).toHaveAttribute('title', email);
  expect(address).toHaveClass('line-clamp-2', 'break-all');
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
});

it('dismisses an open identity when workspace or account changes', async () => {
  const user = { id: 'first', name: 'First account', email: null, avatarUrl: '', isMock: true };
  const workspace = { id: 'first-workspace', name: 'First workspace', role: 'owner' as const, ownerId: user.id };
  const props = { user, authMode: 'mock' as const, activeWorkspace: workspace, onSignOut: vi.fn(), onOpenArcanaBooth: vi.fn() };
  const wrap = (next: typeof props) => <MemoryRouter><I18nProvider><UserMenu {...next} /></I18nProvider></MemoryRouter>;
  const view = render(wrap(props));
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('First workspace');
  view.rerender(wrap({ ...props, activeWorkspace: { ...workspace, id: 'second-workspace', name: 'Second workspace' } }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  await screen.findByRole('dialog');
  view.rerender(wrap({ ...props, user: { ...user, id: 'second', name: 'Second account' } }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
