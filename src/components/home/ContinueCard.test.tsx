import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import ContinueCard from './ContinueCard';
import { pickResumeTask } from './resume-task';
import { readTimeToResume, recordFirstFocusStart, resetTimeToResumeVisit } from '../../features/focus/time-to-resume';

vi.mock('../../services/saved-context.service', () => ({ SAVED_CONTEXT_CHANGED: 'saved', fetchSavedContext: vi.fn().mockResolvedValue([
  { resourceType: 'note', resourceId: 'n1', savedAt: '2026-11-03T08:00:00Z', source: { label: 'Budget notes', workspaceId: 'w', taskId: 'b' } },
  { resourceType: 'note', resourceId: 'n2', savedAt: '2026-11-03T08:00:00Z', source: { label: 'Other task notes', workspaceId: 'w', taskId: 'a' } },
]) }));
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); resetTimeToResumeVisit(); });

const task = (id: string) => ({ id, title: `Task ${id}`, boardId: 'board', boardTitle: 'Project' });
const steps = {
  a: { text: 'Old place', updatedAt: '2026-11-01T08:00:00Z', pausedAt: '2026-11-01T09:00:00Z' },
  b: { text: 'Add the budget table', updatedAt: '2026-11-02T08:00:00Z', pausedAt: '2026-11-02T17:30:00Z' },
  c: { text: 'Never paused', updatedAt: '2026-11-03T08:00:00Z' },
};

it('picks the unfinished task paused most recently', () => {
  expect(pickResumeTask([task('a'), task('b'), task('c')], steps)?.id).toBe('b');
  expect(pickResumeTask([task('c')], steps)).toBeUndefined();
});

it('shows where to start, the checklist and linked context, and continues in one click', async () => {
  const onContinue = vi.fn(), onOpenTask = vi.fn();
  render(<I18nProvider><ContinueCard task={task('b')} nextSteps={steps} currentUser={{ id: 'u' } as never}
    taskRevision={{ b: { checklistItems: [{ id: '1', text: 'x', isDone: true }, { id: '2', text: 'y', isDone: false }] } } as never}
    onContinue={onContinue} onOpenTask={onOpenTask} primaryButton="" quietButton="" sectionLabel="" /></I18nProvider>);
  expect(screen.getByText('Add the budget table')).toBeInTheDocument();
  expect(screen.getByText('1/2 checklist')).toBeInTheDocument();
  expect(await screen.findByText('Budget notes')).toBeInTheDocument();
  expect(screen.queryByText('Other task notes')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue: Task b' }));
  expect(onContinue).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'View details' }));
  expect(onOpenTask).toHaveBeenCalledOnce();
});

it('logs Time to Resume once per visit, on this device', () => {
  recordFirstFocusStart(true, 4200);
  recordFirstFocusStart(false, 9000);
  expect(readTimeToResume()).toEqual([expect.objectContaining({ ms: 4200, resumed: true })]);
});
