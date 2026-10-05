import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FloatingFocus from './FloatingFocus';
import { I18nProvider } from '../../i18n';
import { DEFAULT_POMODORO_TIMER_SETTINGS } from '../../utils/pomodoroTime';

vi.mock('../../features/music/useBrowserMusic', () => ({ useBrowserMusic: () => ({ sessions: [], connected: true, checking: false }) }));
afterEach(() => { cleanup(); localStorage.clear(); });
it.each(['island', 'mixer', 'split', 'tabs', 'deck'])('opens only Tabs with the previous %s preference, keeping color and palette settings', oldStyle => {
  localStorage.setItem('floatingDock.style', oldStyle);
  localStorage.setItem('floatingDock.colors', 'pastel');
  localStorage.setItem('floatingDock.palette', 'ultraviolet');
  const view = render(<I18nProvider><FloatingFocus activeTask={null} focusTasks={[]} cycleTotal={4} remainingSeconds={1500}
    timerState={{ mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null }}
    onStart={vi.fn()} onPause={vi.fn()} onReset={vi.fn()} /></I18nProvider>);
  const timer = view.container.querySelector('.dock-ring');
  expect(view.container.querySelector('.floating-focus')).toHaveAttribute('data-style', 'tabs');
  expect(localStorage.getItem('floatingDock.style')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Switch dock style' })).toBeNull();
  for (const tab of ['Music', 'Beat grid', 'Tasks']) {
    fireEvent.click(screen.getByRole('tab', { name: tab }));
    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(view.container.querySelector('.dock-ring')).toBe(timer);
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Dock settings' }));
  expect(screen.queryByRole('combobox', { name: 'Dock style' })).toBeNull();
  expect(screen.getAllByRole('combobox').filter((element) => !element.classList.contains('dock-task-select'))).toHaveLength(2);
  expect(screen.getByRole('combobox', { name: 'Beat colors' })).toHaveValue('pastel');
  expect(screen.getByRole('combobox', { name: 'Palette' })).toHaveValue('ultraviolet');
});
it('drags from header whitespace and its label, while buttons and settings remain interactive', () => {
  const drag = vi.fn();
  const view = render(<I18nProvider><FloatingFocus activeTask={null} focusTasks={[]} cycleTotal={4} remainingSeconds={1500}
    timerState={{ mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null }}
    onStart={vi.fn()} onPause={vi.fn()} onReset={vi.fn()} onDragStart={drag} /></I18nProvider>);
  const toolbar = view.container.querySelector('.dock-toolbar')!;
  fireEvent.pointerDown(toolbar, { button: 0 });
  fireEvent.pointerDown(view.container.querySelector('.dock-style-name')!, { button: 0 });
  expect(drag).toHaveBeenCalledTimes(2);
  fireEvent.pointerDown(toolbar, { button: 2 });
  const settings = screen.getByRole('button', { name: 'Dock settings' });
  fireEvent.pointerDown(settings.querySelector('svg')!, { button: 0 });
  fireEvent.click(settings);
  fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Palette' }), { button: 0 });
  expect(drag).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByRole('combobox', { name: 'Palette' }), { target: { value: 'ultraviolet' } });
  expect(localStorage.getItem('floatingDock.palette')).toBe('ultraviolet');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Tasks' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Music' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
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
