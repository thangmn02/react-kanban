import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import QuickTaskEntry from './QuickTaskEntry';

afterEach(cleanup);

it('saves one line with Enter, opens the full form with Shift+Enter, and closes with Escape', async () => {
  const onSave = vi.fn().mockResolvedValue(true), onMore = vi.fn(), onClose = vi.fn();
  render(<I18nProvider><QuickTaskEntry isOpen onClose={onClose} onSave={onSave} onMore={onMore} /></I18nProvider>);
  const input = screen.getByRole('textbox', { name: 'New task' });
  expect(input).toHaveFocus();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '  Email the venue  ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onSave).toHaveBeenCalledWith('Email the venue');
  fireEvent.change(input, { target: { value: 'Plan the launch' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(onMore).toHaveBeenCalledWith('Plan the launch');
});

it('keeps the line when saving fails so nothing typed is lost', async () => {
  const onSave = vi.fn().mockResolvedValue(false), onClose = vi.fn();
  render(<I18nProvider><QuickTaskEntry isOpen onClose={onClose} onSave={onSave} onMore={vi.fn()} /></I18nProvider>);
  const input = screen.getByRole('textbox', { name: 'New task' });
  fireEvent.change(input, { target: { value: 'Call back' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onClose).not.toHaveBeenCalled();
  expect(input).toHaveValue('Call back');
});
