import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notify } from '../components/organisms/toast/notify';
import { data } from '../data';
import { fetchBoardSnapshot } from '../services/board.service';
import { readBoardCache } from '../utils/boardCache';
import { useBoardDataManagement, type UseBoardDataManagementParams } from './useBoardDataManagement';

vi.mock('../services/board.service', () => ({ fetchBoardSnapshot: vi.fn(), fetchBoards: vi.fn() }));
vi.mock('../utils/boardCache', () => ({ readBoardCache: vi.fn(), writeBoardCache: vi.fn() }));
vi.mock('./useTaskRealtime', () => ({ useTaskRealtime: vi.fn() }));
vi.mock('../components/organisms/toast/notify', () => ({ notify: { info: vi.fn(), error: vi.fn() } }));

const emptyBoard = { columns: [], list: {}, task: {} };
const signedIn: UseBoardDataManagementParams = { authMode: 'supabase', userId: 'user-a', activeWorkspaceId: 'workspace-a' };
const reminderKey = 'kanban_due_date_reminder_date';

beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(cleanup);

it.each([false, true])('keeps the login and signup screen empty without a demo reminder when cached=%s', (cached) => {
  if (cached) vi.mocked(readBoardCache).mockReturnValue({ boardId: 'demo-board', boardData: data });
  const { result } = renderHook(() => useBoardDataManagement({ authMode: 'supabase', userId: undefined, activeWorkspaceId: null }));
  expect(result.current.boardData).toEqual(emptyBoard);
  expect(notify.info).not.toHaveBeenCalled();
  expect(localStorage.getItem(reminderKey)).toBeNull();
});

it('does not notify about cached tasks when loading the real board fails', async () => {
  vi.mocked(readBoardCache).mockReturnValue({ boardId: 'board-a', boardData: data });
  vi.mocked(fetchBoardSnapshot).mockRejectedValue(new Error('Board unavailable'));
  const { result } = renderHook(() => useBoardDataManagement(signedIn));
  await act(async () => { await result.current.refreshBoardData(); });
  expect(result.current.boardErrorMessage).toBe('Board unavailable');
  expect(notify.info).not.toHaveBeenCalled();
  expect(localStorage.getItem(reminderKey)).toBeNull();
});

it('waits for the current user board to load before reminding about cached due tasks', async () => {
  vi.mocked(readBoardCache).mockReturnValue({ boardId: 'board-a', boardData: data });
  vi.mocked(fetchBoardSnapshot).mockResolvedValue({ boardId: 'board-a', boardData: data });
  const { result } = renderHook(() => useBoardDataManagement(signedIn));
  expect(notify.info).not.toHaveBeenCalled();
  await act(async () => { await result.current.refreshBoardData(); });
  expect(notify.info).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/due today.*overdue/));
});

it('does not notify a new account with no boards, even when a cached snapshot contains due tasks', async () => {
  vi.mocked(readBoardCache).mockReturnValue({ boardId: 'stale-board', boardData: data });
  vi.mocked(fetchBoardSnapshot).mockResolvedValue({ boardId: null, boardData: emptyBoard });
  const { result } = renderHook(() => useBoardDataManagement(signedIn));
  await act(async () => { await result.current.refreshBoardData(); });
  expect(result.current.boardData).toEqual(emptyBoard);
  expect(notify.info).not.toHaveBeenCalled();
  expect(localStorage.getItem(reminderKey)).toBeNull();
});

it('does not emit reminders for retained data after signout or a workspace change', async () => {
  vi.mocked(fetchBoardSnapshot).mockResolvedValue({ boardId: 'board-a', boardData: data });
  const { result, rerender } = renderHook((params: UseBoardDataManagementParams) => useBoardDataManagement(params), { initialProps: signedIn });
  await act(async () => { await result.current.refreshBoardData(); });
  vi.mocked(notify.info).mockClear();
  localStorage.removeItem(reminderKey);
  rerender({ ...signedIn, activeWorkspaceId: 'workspace-b' });
  act(() => result.current.setBoardData({ ...data, task: { ...data.task } }));
  expect(notify.info).not.toHaveBeenCalled();
  rerender({ authMode: 'supabase', userId: undefined, activeWorkspaceId: null });
  act(() => result.current.setBoardData({ ...data, task: { ...data.task } }));
  expect(notify.info).not.toHaveBeenCalled();
});

it('still loads demo tasks and sends real due-date reminders in local mode', async () => {
  vi.mocked(fetchBoardSnapshot).mockResolvedValue({ boardId: 'demo-board', boardData: data });
  const { result } = renderHook(() => useBoardDataManagement({ authMode: 'mock', userId: 'mock-user', activeWorkspaceId: null }));
  expect(result.current.boardData).toEqual(data);
  await act(async () => { await result.current.refreshBoardData(); });
  expect(notify.info).toHaveBeenCalledOnce();
});
