import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import BoardShareDialog from './BoardShareDialog';
import SharedBoardRoute from '../../pages/share/SharedBoardRoute';

const service = vi.hoisted(() => ({ createShareLink: vi.fn(), listShareLinks: vi.fn(), revokeShareLink: vi.fn(), fetchSharedBoard: vi.fn() }));
vi.mock('../../services/share-link.service', () => service);
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); localStorage.setItem('app.language', 'en');
  service.listShareLinks.mockResolvedValue([{ id: 'old', createdAt: '2026-11-01T00:00:00Z' }]);
});

const open = (onClose = vi.fn()) => render(<I18nProvider><BoardShareDialog boardId="b" workspaceId="w" boardTitle="Launch" onClose={onClose} /></I18nProvider>);

it('lists active links and shows a new address once, ready to copy', async () => {
  service.createShareLink.mockResolvedValue({ link: { id: 'new', createdAt: '2026-11-11T00:00:00Z' }, url: 'https://kora.test/share/TOKEN' });
  open();
  expect(await screen.findByText('Active links: 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
  expect(((await screen.findByLabelText('New link')) as HTMLInputElement).value).toBe('https://kora.test/share/TOKEN');
  expect(service.createShareLink).toHaveBeenCalledWith('b', 'w');
  expect(screen.getByText('Active links: 2')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Link created. Copy it now.');
});

it('turns a link off and removes it from the list', async () => {
  service.revokeShareLink.mockResolvedValue(undefined);
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Turn off the link created 2026-11-01' }));
  await waitFor(() => expect(screen.getByText('No active links.')).toBeTruthy());
  expect(service.revokeShareLink).toHaveBeenCalledWith('old');
  expect(screen.getByRole('status').textContent).toBe('Link turned off. It no longer opens.');
});

it('keeps a link listed and says so when turning it off fails', async () => {
  service.revokeShareLink.mockRejectedValue(new Error('Could not turn the link off. It may still work.'));
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Turn off the link created 2026-11-01' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Could not turn the link off. It may still work.');
  expect(screen.getByText('Active links: 1')).toBeTruthy();
});

it('closes on Escape', async () => {
  const onClose = vi.fn();
  open(onClose);
  await screen.findByText('Active links: 1');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

const visit = () => render(<I18nProvider><MemoryRouter initialEntries={['/share/TOKEN']}><Routes><Route path="share/:token" element={<SharedBoardRoute />} /></Routes></MemoryRouter></I18nProvider>);

it('shows the shared board as a table with nothing to press or edit', async () => {
  service.fetchSharedBoard.mockResolvedValue({ title: 'Launch', lists: ['To do', 'Done'], tasks: [
    { title: 'Ship', list: 'Done', priority: 'High', dueDate: '2026-11-20', isDone: true, updatedAt: '2026-11-11T08:00:00Z', assignees: ['Linh', 'An'] },
    { title: 'Plan', list: 'To do', priority: null, dueDate: null, isDone: false, updatedAt: null, assignees: [] },
  ] });
  const view = visit();
  expect(await screen.findByRole('heading', { name: 'Launch' })).toBeTruthy();
  expect(service.fetchSharedBoard).toHaveBeenCalledWith('TOKEN');
  expect(screen.getByText('1 of 2 tasks done')).toBeTruthy();
  expect(screen.getByRole('rowheader', { name: 'Ship' })).toBeTruthy();
  expect(screen.getByText('Linh, An')).toBeTruthy();
  expect(view.container.querySelectorAll('button, input, select, textarea, a, form')).toHaveLength(0);
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
});

it('gives one plain message for a link that is off, unknown or malformed', async () => {
  service.fetchSharedBoard.mockResolvedValue(null);
  visit();
  expect(await screen.findByRole('heading', { name: 'This link is not available' })).toBeTruthy();
});

it('says so when the board cannot be loaded', async () => {
  service.fetchSharedBoard.mockRejectedValue(new Error('network'));
  visit();
  expect((await screen.findByRole('alert')).textContent).toBe('Check your connection and reload the page.');
});
