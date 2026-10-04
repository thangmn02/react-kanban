import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import NativeUpdateDialog from './NativeUpdateDialog';

const updater = vi.hoisted(() => ({ check: vi.fn(), close: vi.fn().mockResolvedValue(undefined),
  install: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: updater.check }));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  updater.check.mockResolvedValue(null);
});
afterEach(cleanup);
const available = () => ({ version: '0.1.6', close: updater.close, downloadAndInstall: updater.install });
const open = (close = vi.fn()) => render(<I18nProvider><NativeUpdateDialog onClose={close} /></I18nProvider>);

it('checks once when opened and never installs the current version', async () => {
  open();
  expect(await screen.findByText('Kora is up to date.')).toBeVisible();
  expect(updater.check).toHaveBeenCalledExactlyOnceWith({ timeout: 15_000 });
  expect(updater.install).not.toHaveBeenCalled();
});
it('requires confirmation and frees unused update resources on close', async () => {
  updater.check.mockResolvedValue(available());
  const view = open();
  expect(await screen.findByText('Version available: 0.1.6')).toBeVisible();
  expect(screen.getByText('Save your work first. Kora will restart.')).toBeVisible();
  expect(updater.install).not.toHaveBeenCalled();
  view.unmount(); expect(updater.close).toHaveBeenCalledOnce();
});
it('installs only once, reports progress, and prevents dismissal while installing', async () => {
  updater.check.mockResolvedValue(available());
  let finish: () => void = () => {};
  updater.install.mockImplementationOnce((emit) => {
    emit({ event: 'Started', data: { contentLength: 100 } });
    emit({ event: 'Progress', data: { chunkLength: 40 } });
    return new Promise<void>((resolve) => { finish = resolve; });
  });
  const close = vi.fn(); open(close);
  const confirm = await screen.findByRole('button', { name: 'Update and restart' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(updater.install).toHaveBeenCalledOnce();
  expect(updater.install).toHaveBeenCalledWith(expect.any(Function), { timeout: 120_000, restartAfterInstall: true });
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40');
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  await act(async () => finish());
});
it('retries a failed check without exposing internal errors', async () => {
  updater.check.mockRejectedValueOnce(new Error('Internal network detail')).mockResolvedValue(null);
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Kora is up to date.')).toBeVisible();
  expect(screen.queryByText('Internal network detail')).toBeNull();
});
it('rechecks after a rejected installer instead of pretending installation succeeded', async () => {
  updater.check.mockResolvedValue(available());
  updater.install.mockRejectedValueOnce(new Error('Invalid signature'));
  open(); fireEvent.click(await screen.findByRole('button', { name: 'Update and restart' }));
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible();
  expect(updater.close).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(updater.check).toHaveBeenCalledTimes(2));
});
it('releases a pending update when the dialog has already been closed', async () => {
  let resolve: (value: ReturnType<typeof available>) => void = () => {};
  updater.check.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const view = open(); view.unmount();
  await act(async () => resolve(available()));
  expect(updater.close).toHaveBeenCalledOnce();
  expect(updater.install).not.toHaveBeenCalled();
});
