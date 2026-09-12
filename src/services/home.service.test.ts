import { beforeEach, expect, it, vi } from 'vitest';
import { fetchHomeDashboardData } from './home.service';
import type { AppUser } from '../types/auth.type';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ default: {}, requireSupabaseClient: () => ({ from }) }));
const user: AppUser = { id: 'u', name: 'Alex', email: 'alex@example.com', avatarUrl: '', isMock: false };

beforeEach(() => vi.clearAllMocks());

it('does not query across workspaces while no workspace is selected', async () => {
  expect((await fetchHomeDashboardData({ currentUser: user })).myTasks).toEqual([]);
  expect(from).not.toHaveBeenCalled();
});

it('pages beyond server limits, excludes completed work and resolves boards beyond recent six', async () => {
  const boards = Array.from({ length: 8 }, (_, index) => ({ id: `b${index}`, title: `Board ${index}`, description: null, created_at: '', updated_at: '' }));
  const tasks = Array.from({ length: 503 }, (_, index) => ({ id: `${index}`, board_id: 'b7', title: `Task ${index}`, priority: null, due_date: null, assignees: [{ userId: 'u', name: 'Alex', avatar: '' }], is_done: index === 0 }));
  const ranges: number[] = [];
  const eq = vi.fn();
  from.mockImplementation((table: string) => {
    const query = {
      select: () => query, is: () => query, order: () => query,
      eq: (column: string, value: string) => { eq(column, value); return query; },
      range: (start: number, end: number) => {
        if (table === 'tasks') ranges.push(start);
        return Promise.resolve({ data: (table === 'boards' ? boards : tasks).slice(start, end + 1), error: null });
      },
    };
    return query;
  });
  const result = await fetchHomeDashboardData({ currentUser: user, workspaceId: 'workspace' });
  expect(ranges).toEqual([0, 500]);
  expect(eq).toHaveBeenCalledWith('workspace_id', 'workspace');
  expect(result.myTasks).toHaveLength(502);
  expect(result.myTasks.some((task) => task.id === '0')).toBe(false);
  expect(result.myTasks.every((task) => task.boardTitle === 'Board 7')).toBe(true);
  expect(result.recentBoards).toHaveLength(6);
});
