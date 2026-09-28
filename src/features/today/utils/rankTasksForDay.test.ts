import { describe, expect, it } from 'vitest';
import type { HomeTaskSummary } from '../../../services/home.service';
import { rankTasksForDay } from './rankTasksForDay';

const task = (title: string, dueDate: string | null, priority: HomeTaskSummary['priority'] = null): HomeTaskSummary => ({ id: title, boardId: 'b', boardTitle: 'Board', title, dueDate, priority });
const today = new Date(2026, 8, 28);

describe('rankTasksForDay', () => {
  it('ranks overdue, today, tomorrow, week, then unscheduled work', () => {
    const ranked = rankTasksForDay([
      task('No date', null), task('This week', '2026-10-03'), task('Tomorrow', '2026-09-29'),
      task('Today', '2026-09-28'), task('Overdue', '2026-09-25'),
    ], today);
    expect(ranked.map(({ task: item }) => item.title)).toEqual(['Overdue', 'Today', 'Tomorrow', 'This week', 'No date']);
    expect(ranked[0]).toMatchObject({ score: 1003, reason: 'overdue', daysOverdue: 3 });
  });

  it('stacks priority points and applies deterministic tie-breakers', () => {
    const ranked = rankTasksForDay([
      task('Zulu', null, 'Medium'), task('Alpha', null, 'Medium'), task('Later', '2026-10-10', 'Medium'),
      task('Earlier', '2026-10-09', 'Medium'),
    ], today);
    expect(ranked.map(({ task: item }) => item.title)).toEqual(['Earlier', 'Later', 'Alpha', 'Zulu']);
  });
});
