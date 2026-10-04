import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FloatingFocus from './FloatingFocus';
import { I18nProvider } from '../../i18n';
import { DEFAULT_POMODORO_TIMER_SETTINGS } from '../../utils/pomodoroTime';

vi.mock('../../features/music/useBrowserMusic', () => ({ useBrowserMusic: () => ({ sessions: [], connected: true, checking: false }) }));
afterEach(() => { cleanup(); localStorage.clear(); });
it('cycles all styles using the arrow only, keeping color and palette settings', () => {
  const view = render(<I18nProvider><FloatingFocus activeTask={null} focusTasks={[]} cycleTotal={4} remainingSeconds={1500}
    timerState={{ mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null }}
    onStart={vi.fn()} onPause={vi.fn()} onReset={vi.fn()} /></I18nProvider>);
  const timer = view.container.querySelector('.dock-ring');
  for (const style of ['mixer', 'split', 'tabs', 'deck', 'island']) {
    fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
    expect(view.container.querySelector('.floating-focus')).toHaveAttribute('data-style', style);
    expect(view.container.querySelector('.dock-ring')).toBe(timer);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Dock settings' }));
  expect(screen.queryByRole('combobox', { name: 'Dock style' })).toBeNull();
  expect(screen.getAllByRole('combobox').filter((element) => !element.classList.contains('dock-task-select'))).toHaveLength(2);
});
it('lets the native timer open shared duration and mode settings, even without a focus task', async () => {
  const change = vi.fn(), mode = vi.fn(), start = vi.fn();
  render(<I18nProvider><FloatingFocus activeTask={null} focusTasks={[]} cycleTotal={4} remainingSeconds={1500}
    timerState={{ mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null }}
    timerSettings={DEFAULT_POMODORO_TIMER_SETTINGS} onTimerSettingsChange={change} onModeChange={mode}
    onStart={start} onPause={vi.fn()} onReset={vi.fn()} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Timer settings' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Focus length' }), { target: { value: '45' } });
  expect(change).toHaveBeenCalledWith({ focusMinutes: 45 });
  fireEvent.click(screen.getByRole('button', { name: 'Short break' }));
  expect(mode).toHaveBeenCalledWith('shortBreak');
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(start).toHaveBeenCalledOnce();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryAllByRole('spinbutton')).toHaveLength(0));
});
