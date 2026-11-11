import { beforeEach, expect, it } from 'vitest';
import { clearWaitingOn, followUpDue, readFollowUps, setWaitingOn } from './task-followups';
import { splitStaleTasks } from './utils/staleTasks';

const scope = { userId: 'u', workspaceId: 'w' };
beforeEach(() => localStorage.clear());

it('saves, reads and clears who a task is waiting on', () => {
  expect(setWaitingOn(scope, 't1', '  Linh  ', '2026-11-14')).toBe(true);
  expect(readFollowUps(scope).t1).toMatchObject({ who: 'Linh', followUpOn: '2026-11-14' });
  clearWaitingOn(scope, 't1');
  expect(readFollowUps(scope)).toEqual({});
});

it('keeps follow-ups apart per user and workspace', () => {
  setWaitingOn(scope, 't1', 'Linh', '2026-11-14');
  expect(readFollowUps({ userId: 'u', workspaceId: 'other' })).toEqual({});
  expect(readFollowUps({ userId: 'someone-else', workspaceId: 'w' })).toEqual({});
});

it('refuses a follow-up day that is not a calendar day and ignores damaged storage', () => {
  expect(setWaitingOn(scope, 't1', 'Linh', 'soon')).toBe(false);
  expect(readFollowUps(scope)).toEqual({});
  localStorage.setItem('kora.taskFollowUps.v1:u:w', JSON.stringify({ bad: { who: 1 }, ok: { who: 'An', followUpOn: '2026-11-12', setAt: 'x' } }));
  expect(Object.keys(readFollowUps(scope))).toEqual(['ok']);
  localStorage.setItem('kora.taskFollowUps.v1:u:w', '{not json');
  expect(readFollowUps(scope)).toEqual({});
});

it('is due on the follow-up day and after it, not before', () => {
  const item = { who: 'Linh', followUpOn: '2026-11-14', setAt: '' };
  expect(followUpDue(item, '2026-11-13')).toBe(false);
  expect(followUpDue(item, '2026-11-14')).toBe(true);
  expect(followUpDue(item, '2026-12-01')).toBe(true);
});

it('folds only undated tasks left alone for two weeks', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const task = (id: string, updatedAt: string | null, dueDate: string | null = null) => ({ id, updatedAt, dueDate });
  const { fresh, stale } = splitStaleTasks([
    task('recent', '2026-11-18T00:00:00Z'),
    task('old', '2026-10-01T00:00:00Z'),
    task('old-but-dated', '2026-10-01T00:00:00Z', '2026-11-25'),
    task('unknown', null),
  ], now);
  expect(stale.map(item => item.id)).toEqual(['old']);
  expect(fresh.map(item => item.id)).toEqual(['recent', 'old-but-dated', 'unknown']);
});

it('keeps a personal deadline only when it is earlier than the real one, and clears it', async () => {
  const { readOwnDeadlines, setOwnDeadline } = await import('./task-followups');
  expect(setOwnDeadline(scope, 't1', '2026-11-20', '2026-11-20')).toBe(false);
  expect(setOwnDeadline(scope, 't1', '2026-11-25', '2026-11-20T00:00:00Z')).toBe(false);
  expect(setOwnDeadline(scope, 't1', 'next week', '2026-11-20')).toBe(false);
  expect(readOwnDeadlines(scope)).toEqual({});
  expect(setOwnDeadline(scope, 't1', '2026-11-18', '2026-11-20')).toBe(true);
  expect(readOwnDeadlines(scope).t1).toEqual({ on: '2026-11-18' });
  expect(setOwnDeadline(scope, 't1', '')).toBe(true);
  expect(readOwnDeadlines(scope)).toEqual({});
});

it('nudges once when a personal deadline arrives, and only for open tasks', async () => {
  const { setOwnDeadline, takeDueNudges } = await import('./task-followups');
  setOwnDeadline(scope, 'due', '2026-11-18', '2026-11-30');
  setOwnDeadline(scope, 'later', '2026-11-25', '2026-11-30');
  setOwnDeadline(scope, 'gone', '2026-11-18', '2026-11-30');
  const open = new Set(['due', 'later']);
  expect(takeDueNudges(scope, '2026-11-17', open)).toEqual([]);
  expect(takeDueNudges(scope, '2026-11-18', open)).toEqual(['due']);
  expect(takeDueNudges(scope, '2026-11-18', open)).toEqual([]);
  expect(takeDueNudges(scope, '2026-11-19', open)).toEqual([]);
  expect(takeDueNudges(scope, '2026-11-25', open)).toEqual(['later']);
});

it('finds tasks worked on during a day from their Next step', async () => {
  const { touchedOn } = await import('../focus/next-steps');
  const day = new Date(2026, 10, 12, 15), at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
  const steps = { paused: { text: '', updatedAt: at(10, 9), pausedAt: at(12, 9) }, written: { text: 'x', updatedAt: at(12, 23) }, old: { text: 'x', updatedAt: at(11, 23), pausedAt: at(11, 23) } };
  expect(touchedOn(steps, ['paused', 'written', 'old', 'none'], day)).toEqual(['paused', 'written']);
});
