import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { useSummaryCompletion } from './use-summary-completion';

afterEach(cleanup);
it('locks duplicate completion and only removes a task after persistence succeeds', async () => {
  let finish!: (result: boolean) => void;
  const complete = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useSummaryCompletion(complete), { wrapper: I18nProvider });
  const task = { id: 'task', title: 'Write notes' };
  let request!: Promise<boolean | undefined>;
  act(() => { request = result.current.run(task); void result.current.run(task); });
  expect(complete).toHaveBeenCalledOnce();
  expect(result.current.pending.has(task.id)).toBe(true);
  expect(result.current.completed.size).toBe(0);
  await act(async () => { finish(false); await request; });
  expect(result.current.completed.size).toBe(0);
  expect(result.current.message).toContain('Try again');
  act(() => { request = result.current.run(task); });
  await act(async () => { finish(true); await request; });
  expect(result.current.completed.has(task.id)).toBe(true);
  expect(result.current.pending.size).toBe(0);
  expect(result.current.message).toContain(task.title);
});
