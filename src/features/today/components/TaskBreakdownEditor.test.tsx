import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import TaskBreakdownEditor from './TaskBreakdownEditor';
afterEach(cleanup);

it('requires review, preserves edits after a save error, and only starts after a successful save', async () => {
  const onApply = vi.fn().mockRejectedValueOnce(new Error('save_failed')).mockResolvedValue(undefined);
  const onStart = vi.fn();
  render(<I18nProvider><TaskBreakdownEditor onGenerate={async () => ['Read notes', 'Write outline', 'Review draft']} onApply={onApply} onStart={onStart} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Help me plan this/ }));
  await screen.findByDisplayValue('Read notes');
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Read the customer brief' } });
  fireEvent.click(screen.getByRole('button', { name: /Save steps & focus/ }));
  await screen.findByRole('alert');
  expect(onStart).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Read the customer brief')).toBeVisible();
  const firstIds = onApply.mock.calls[0][0].map((item: { id: string }) => item.id);
  fireEvent.click(screen.getByRole('button', { name: /Save steps & focus/ }));
  await waitFor(() => expect(onStart).toHaveBeenCalledWith('Read the customer brief'));
  expect(onApply.mock.calls[1][0].map((item: { id: string }) => item.id)).toEqual(firstIds);
});

it('aborts a pending suggestion when the mission changes/unmounts', async () => {
  let signal: AbortSignal | undefined;
  let finish!: (steps: string[]) => void;
  const onApply = vi.fn();
  const view = render(<I18nProvider><TaskBreakdownEditor onGenerate={(value) => { signal = value; return new Promise((resolve) => { finish = resolve; }); }} onApply={onApply} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: /Help me plan this/ }));
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(['One', 'Two', 'Three']));
  expect(onApply).not.toHaveBeenCalled();
});
