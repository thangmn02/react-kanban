import type { FocusTask, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';
import MusicPlayer, { MusicSetup } from '../../features/music/MusicPlayer';
import { useBrowserMusic } from '../../features/music/useBrowserMusic';

export interface FloatingFocusProps {
  activeTask: FocusTask | null;
  focusTasks: FocusTask[];
  timerState: PomodoroTimerState;
  remainingSeconds: number;
  cycleTotal: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onActiveTaskChange?: (taskId: string) => void;
  onMarkDoneAndNext?: (taskId: string) => void;
}

export default function FloatingFocus({ activeTask, focusTasks, timerState, remainingSeconds, cycleTotal, onStart, onPause, onReset, onActiveTaskChange, onMarkDoneAndNext }: FloatingFocusProps) {
  const { t } = useI18n();
  const music = useBrowserMusic();
  const taskId = activeTask?.id || timerState.activeTaskId || '';
  const tasks = activeTask && !focusTasks.some((task) => task.id === activeTask.id) ? [activeTask, ...focusTasks] : focusTasks;
  const modeLabel = timerState.mode === 'focus' ? t('focus.mode.focus') : timerState.mode === 'shortBreak' ? t('focus.mode.shortBreak') : t('focus.mode.longBreak');
  return <main className="floating-focus" aria-label="Floating Focus">
    <section className="floating-timer" aria-label={t('focus.timer.pomodoro')}>
      <div className="timer-island glass">
        {music.sessions.length > 0 && music.playing && <span className="music-dot playing" aria-hidden="true" />}
        <select className="task-select" aria-label={t('focus.timer.chooseTask')} value={taskId} disabled={!tasks.length || !onActiveTaskChange} onChange={(event) => onActiveTaskChange?.(event.target.value)}>
          {!tasks.length && <option value="">{t('home.focusEmptyTitle')}</option>}
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
        <span className="cycle">{Math.min((timerState.completedCycleFocus || 0) + 1, cycleTotal)}/{cycleTotal}</span>
        <span className="time">{formatPomodoroTime(remainingSeconds)}</span>
        <span className="divider" aria-hidden="true" />
        <button className="round solid" type="button" disabled={!tasks.length} onClick={timerState.isRunning ? onPause : onStart} aria-label={timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{timerState.isRunning ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
        </button>
      </div>
      <div className="timer-tools"><span>{modeLabel}</span><button type="button" onClick={onReset}>{t('focus.timer.reset')}</button><button type="button" disabled={!taskId || !onMarkDoneAndNext || activeTask?.isDone} onClick={() => onMarkDoneAndNext?.(taskId)}>{t('floating.completeNext')}</button></div>
    </section>
    {music.sessions.length > 0 && <MusicPlayer music={music} />}
    <MusicSetup music={music} />
  </main>;
}
