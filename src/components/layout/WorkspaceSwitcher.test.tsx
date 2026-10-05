import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { WorkspaceSummary } from '../../types/auth.type';
import WorkspaceSwitcher from './WorkspaceSwitcher';

afterEach(cleanup);

it('distinguishes duplicate names consistently and selects the underlying workspace', () => {
  const workspaces: WorkspaceSummary[] = [
    { id: 'workspace-b', name: 'My Workspace', role: 'owner', ownerId: 'user' },
    { id: 'workspace-a', name: 'My Workspace', role: 'owner', ownerId: 'user' },
    { id: 'workspace-team', name: 'Team', role: 'member', ownerId: 'other' },
  ];
  const onWorkspaceChange = vi.fn();
  const view = render(<I18nProvider><WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId="workspace-b" onWorkspaceChange={onWorkspaceChange} /></I18nProvider>);
  const select = screen.getByRole('combobox', { name: 'Active workspace' });
  expect(screen.getByRole('option', { name: 'My Workspace (1)' })).toHaveValue('workspace-a');
  expect(screen.getByRole('option', { name: 'My Workspace (2)' })).toHaveValue('workspace-b');
  expect(screen.getByRole('option', { name: 'Team' })).toHaveValue('workspace-team');
  expect(select).toHaveValue('workspace-b');
  fireEvent.change(select, { target: { value: 'workspace-a' } });
  expect(onWorkspaceChange).toHaveBeenCalledExactlyOnceWith('workspace-a');
  view.rerender(<I18nProvider><WorkspaceSwitcher workspaces={[...workspaces].reverse()} activeWorkspaceId="workspace-a" onWorkspaceChange={onWorkspaceChange} /></I18nProvider>);
  expect(screen.getByRole('option', { name: 'My Workspace (1)' })).toHaveValue('workspace-a');
  expect(select).toHaveValue('workspace-a');
});
