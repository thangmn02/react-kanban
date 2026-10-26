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

it('ignores an older snapshot that resolves after the current board request', async () => {
  let finishOld!: (value: { boardId: string; boardData: typeof data }) => void;
  vi.mocked(fetchBoardSnapshot).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  vi.mocked(fetchBoardSnapshot).mockResolvedValueOnce({ boardId: 'new-board', boardData: emptyBoard });
  const { result } = renderHook(() => useBoardDataManagement(signedIn));
  let old!: Promise<void>;
  act(() => { old = result.current.refreshBoardData({ boardId: 'old-board' }); });
  await act(async () => { await result.current.refreshBoardData({ boardId: 'new-board' }); });
  await act(async () => { finishOld({ boardId: 'old-board', boardData: data }); await old; });
  expect(result.current.activeBoardId).toBe('new-board');
  expect(result.current.boardData).toEqual(emptyBoard);
});

it('ignores an aborted contextual snapshot', async () => {
  let finish!: (value: { boardId: string; boardData: typeof data }) => void;
  vi.mocked(fetchBoardSnapshot).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useBoardDataManagement(signedIn));
  const controller = new AbortController();
  let request!: Promise<void>;
  act(() => { request = result.current.refreshBoardData({ boardId: 'aborted', signal: controller.signal }); });
  controller.abort();
  await act(async () => { finish({ boardId: 'aborted', boardData: data }); await request; });
  expect(result.current.activeBoardId).not.toBe('aborted');
});

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

it('rejects old mutation refresh callbacks without cancelling the new workspace load',async()=>{
 let finish!:(value:{boardId:string;boardData:typeof data})=>void;
 vi.mocked(fetchBoardSnapshot).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const hook=renderHook(params=>useBoardDataManagement(params),{initialProps:signedIn});
 const oldRefresh=hook.result.current.refreshBoardData;
 hook.rerender({...signedIn,activeWorkspaceId:'workspace-b'});
 let pending!:Promise<void>;
 act(()=>{pending=hook.result.current.refreshBoardData({boardId:'board-b'});});
 await act(async()=>{await oldRefresh({boardId:'board-a'});});
 expect(fetchBoardSnapshot).toHaveBeenCalledOnce();
 await act(async()=>{finish({boardId:'board-b',boardData:data});await pending;});
 expect(hook.result.current.activeBoardId).toBe('board-b');
});
