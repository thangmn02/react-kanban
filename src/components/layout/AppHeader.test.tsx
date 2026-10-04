import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import AppHeader from './AppHeader';

const native = vi.hoisted(() => ({ enabled: false }));
vi.mock('../../features/native/runtime', () => ({ isNativeWidget: () => native.enabled }));
beforeEach(() => { localStorage.clear(); native.enabled = false; });
afterEach(cleanup);
const props = {
  authMode: 'mock' as const,
  user: { id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: true },
  workspaces: [], activeWorkspace: null, activeWorkspaceId: null, isLocalDemoMode: false,
  onGoHome: vi.fn(), onGoToday: vi.fn(), onOpenCommandPalette: vi.fn(), onCreateBoard: vi.fn(),
  onWorkspaceChange: vi.fn(), onSignOut: vi.fn(), onOpenArcanaBooth: vi.fn(),
};
it.each([['en', 'Download Kora for Windows'], ['vi', 'Tải Kora cho Windows']])('offers a labeled installer download in %s', (language, label) => {
  localStorage.setItem('app.language', language);
  render(<I18nProvider><AppHeader {...props} /></I18nProvider>);
  const download = screen.getByRole('link', { name: label });
  expect(download).toHaveAttribute('href', '/downloads/Kora-setup.exe');
  expect(download).toHaveAttribute('download', 'Kora-setup.exe');
});
it('does not offer a download inside the installed app', () => {
  native.enabled = true;
  render(<I18nProvider><AppHeader {...props} /></I18nProvider>);
  expect(screen.queryByRole('link', { name: /Download Kora/ })).toBeNull();
});
