import { beforeEach, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ focus: vi.fn(), tasks: vi.fn(), getSession: vi.fn(), from: vi.fn(), tableResults: {} as Record<string, unknown>, calls: [] as unknown[][] }));
vi.mock('./focusSession.service', () => ({ fetchDailyFocusStats: mocked.focus }));
vi.mock('./task.service', () => ({ fetchTasks: mocked.tasks }));
vi.mock('../lib/supabase', () => ({ requireSupabaseClient: () => ({ auth: { getSession: mocked.getSession }, from: mocked.from }) }));
import { fetchIdentitySummary } from './identity-summary.service';
const user = { id: 'current-account', name: 'Alex', email: null, avatarUrl: '', isMock: false };
beforeEach(() => {
  vi.clearAllMocks(); mocked.calls = [];
  mocked.focus.mockResolvedValue({ completedSessions: 2, focusedMinutes: 46 });
  mocked.tasks.mockResolvedValue([{ is_done: true }, { is_done: false }, { is_done: true, deleted_at: 'deleted' }, { is_done: true, archived_at: 'archived' }]);
  mocked.getSession.mockResolvedValue({ data: { session: { user: { id: user.id } } } });
  mocked.tableResults = { tasks: { count: 7, error: null }, workspace_members: { data: { created_at: '2026-10-01T00:00:00Z' }, error: null } };
  mocked.from.mockImplementation((table: string) => {
    const query = { select: (...args: unknown[]) => { mocked.calls.push([table, 'select', ...args]); return query; }, eq: (...args: unknown[]) => { mocked.calls.push([table, 'eq', ...args]); return query; }, is: (...args: unknown[]) => { mocked.calls.push([table, 'is', ...args]); return query; }, maybeSingle: () => Promise.resolve(mocked.tableResults[table]), then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocked.tableResults[table]).then(resolve) };
    return query;
  });
});
it('counts persisted local activity without inventing a joined date', async () => {
  expect(await fetchIdentitySummary({ ...user, isMock: true }, 'workspace')).toEqual({ focusSessions: 2, focusedMinutes: 46, completedTasks: 1, joinedAt: null, unavailable: false });
  expect(mocked.focus).toHaveBeenCalledWith('workspace', user.id);
  expect(mocked.tasks).toHaveBeenCalledWith({ workspaceId: 'workspace' });
  expect(mocked.from).not.toHaveBeenCalled();
});
it('uses an exact scoped count and only the account’s own membership date', async () => {
  expect(await fetchIdentitySummary(user, 'workspace')).toMatchObject({ completedTasks: 7, joinedAt: '2026-10-01T00:00:00Z', unavailable: false });
  expect(mocked.calls).toContainEqual(['tasks', 'select', 'id', { count: 'exact', head: true }]);
  expect(mocked.calls).toContainEqual(['tasks', 'eq', 'workspace_id', 'workspace']);
  expect(mocked.calls).toContainEqual(['workspace_members', 'eq', 'user_id', user.id]);
  expect(mocked.calls).toContainEqual(['tasks', 'is', 'deleted_at', null]);
  expect(mocked.calls).toContainEqual(['tasks', 'is', 'archived_at', null]);
});
it('keeps failed activity unavailable while retaining successful reads', async () => {
  mocked.focus.mockRejectedValue(Error('offline'));
  expect(await fetchIdentitySummary(user, 'workspace')).toMatchObject({ focusSessions: null, focusedMinutes: null, completedTasks: 7, unavailable: true });
});
it('rejects a snapshot if the account changes during the reads', async () => {
  mocked.getSession.mockResolvedValueOnce({ data: { session: { user: { id: user.id } } } }).mockResolvedValueOnce({ data: { session: { user: { id: 'different-account' } } } });
  await expect(fetchIdentitySummary(user, 'workspace')).rejects.toThrow('account changed');
});
it('does not query unscoped activity when no workspace is selected', async () => {
  expect(await fetchIdentitySummary(user, null)).toMatchObject({ focusSessions: null, completedTasks: null, unavailable: false });
  expect(mocked.focus).not.toHaveBeenCalled(); expect(mocked.from).not.toHaveBeenCalled();
});
