import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import HomeFocusView, { type HomeFocusControls } from './HomeFocusView';

afterEach(cleanup);
const task = { id: 'a', title: 'Write proposal', boardId: 'board', boardTitle: 'Project', listTitle: 'Doing' };
function controls(): HomeFocusControls {
  return {
    session: {
      focusTasks: [task], timerState: { mode: 'focus', activeTaskId: 'a', isRunning: false, remainingSeconds: 1200, startedAt: 1, endsAt: null, plannedSeconds: 1500 },
      remainingSeconds: 1200, dailyFocusStats: { focusedMinutes: 25, completedSessions: 1, interruptedSessions: 0, topTaskTitle: null },
      activeFocusIntention: { taskId: 'a', text: 'Draft the opening paragraph' },
      setFocusIntention: vi.fn(),
      handleStartFocusTimer: vi.fn(), pauseTimer: vi.fn(), resetTimer: vi.fn(), setMode: vi.fn(), setIsFocusDockCollapsed: vi.fn(),
    }, onMarkDone: vi.fn().mockResolvedValue(true),
  };
}
it('uses the shared countdown, intention and guarded controls; exit does not stop the timer', () => {
  const props = controls(); const exit = vi.fn();
  render(<I18nProvider><HomeFocusView {...props} task={task} onExit={exit} /></I18nProvider>);
  expect(screen.getByRole('timer')).toHaveTextContent('20:00');
  expect(screen.getByText('Draft the opening paragraph')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(props.session.handleStartFocusTimer).toHaveBeenCalledWith('a');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(props.session.resetTimer).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Short break' }));
  expect(props.session.setMode).toHaveBeenCalledWith('shortBreak');
  fireEvent.click(screen.getByRole('button', { name: 'Exit focus' }));
  expect(exit).toHaveBeenCalledOnce();
  expect(props.session.pauseTimer).not.toHaveBeenCalled();
});
it('keeps the view on failed completion and exits only after persisted success', async () => {
  const props = controls(); const exit = vi.fn();
  vi.mocked(props.onMarkDone).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<I18nProvider><HomeFocusView {...props} task={task} onExit={exit} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Mark done' })).toBeEnabled());
  expect(exit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
  await waitFor(() => expect(exit).toHaveBeenCalledOnce());
  expect(props.onMarkDone).toHaveBeenCalledWith(task);
  expect(props.session.pauseTimer).toHaveBeenCalledOnce();
});
