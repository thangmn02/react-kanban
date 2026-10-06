import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { FocusTask, PomodoroTimerState, PomodoroTimerSettings, PomodoroMode } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';
import { MusicFeedback, MusicGrid, MusicSetup, MusicTrack, MusicNowPlaying } from '../../features/music/MusicPlayer';
import { useBrowserMusic } from '../../features/music/useBrowserMusic';
import { useDockPreferences, beatColorModes, beatPalettes } from './useDockPreferences';

export interface FloatingFocusProps {
  activeTask: FocusTask | null;
  focusTasks: FocusTask[];
  timerState: PomodoroTimerState;
  timerSettings?: PomodoroTimerSettings;
  onTimerSettingsChange?: (patch: Partial<PomodoroTimerSettings>) => void;
  onModeChange?: (mode: PomodoroMode) => void;
  remainingSeconds: number;
  cycleTotal: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onActiveTaskChange?: (taskId: string) => void;
  onMarkDoneAndNext?: (taskId: string) => void;
  onPopOut?: () => void;
  onReturnToTab?: () => void;
  onDismiss?: () => void;
  isWidget?: boolean;
  canPopOut?: boolean;
  widgetError?: string;
  onDragStart?: () => void;
  onMusicSetup?: () => void;
  nativeControls?: ReactNode;
  returnLabel?: string;
}

const ringCircumference = 2 * Math.PI * 54;
const glide = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
type Card = 'focus' | 'beat' | 'music';

function DockIcon({ kind }: { kind: 'settings' | 'widget' | 'return' | 'close' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'settings' ? <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></>
        : kind === 'close' ? <path d="m6 6 12 12M6 18 18 6" />
          : <><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="11" y="11" width="8" height="7" rx="1" />{kind === 'return' && <path d="m9 7-3 3m0-3v3h3" />}</>}
  </svg>;
}

export default function FloatingFocus(props: FloatingFocusProps) {
  const { t } = useI18n();
  const music = useBrowserMusic();
  const preferences = useDockPreferences();
  const reducedMotion = useReducedMotion();
  const groupId = useId();
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Card>('focus');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const toolbar = toolbarRef.current;
    const owner = toolbar?.ownerDocument;
    const close = (event: PointerEvent) => { if (toolbar && !event.composedPath().includes(toolbar)
      && !event.composedPath().includes(timeButtonRef.current as EventTarget)) setSettingsOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); settingsButtonRef.current?.focus(); }
    };
    owner?.addEventListener('pointerdown', close);
    owner?.addEventListener('keydown', escape);
    return () => { owner?.removeEventListener('pointerdown', close); owner?.removeEventListener('keydown', escape); };
  }, [settingsOpen, props.isWidget]);

  const { activeTask, focusTasks, timerState, remainingSeconds, cycleTotal, onStart, onPause, onReset, onActiveTaskChange, onMarkDoneAndNext } = props;
  const taskId = activeTask?.id || timerState.activeTaskId || '';
  const tasks = activeTask && !focusTasks.some((task) => task.id === activeTask.id) ? [activeTask, ...focusTasks] : focusTasks;
  const modeLabel = timerState.mode === 'focus' ? t('focus.mode.focus') : timerState.mode === 'shortBreak' ? t('focus.mode.shortBreak') : t('focus.mode.longBreak');
  const hasMusic = music.sessions.length > 0;
  const cycle = Math.min((timerState.completedCycleFocus || 0) + 1, cycleTotal);
  const progress = Math.max(0, Math.min(1, remainingSeconds / Math.max(1, timerState.plannedSeconds || remainingSeconds || 1500)));
  const layoutTransition = reducedMotion ? { duration: 0 } : glide;
  const activeTab = tab;
  const cards: Card[] = ['focus', 'music', 'beat'];
  const hidden = (card: Card) => card !== 'focus' && card !== activeTab;

  return <LayoutGroup id={groupId}>
    <main ref={dockRef} className="floating-focus glass" aria-label="Floating Focus" data-style="tabs">
      <div className="dock-toolbar" ref={toolbarRef} data-draggable={Boolean(props.onDragStart)} onPointerDown={(event) => {
        if (event.button === 0 && !(event.target as HTMLElement).closest('button, a, input, select, textarea, [role="dialog"]')) props.onDragStart?.();
      }}>
        <span className="dock-style-name">{t('dock.style.tabs')}</span>
        <button ref={settingsButtonRef} type="button" className="dock-icon-button" aria-label={t('dock.settings')} title={t('dock.settings')}
          aria-expanded={settingsOpen} aria-controls={settingsId} aria-haspopup="dialog" onClick={() => setSettingsOpen((current) => !current)}><DockIcon kind="settings" /></button>
        <button type="button" className="dock-icon-button" aria-label={props.returnLabel || t(props.isWidget ? 'dock.return' : 'dock.widget')}
          title={props.returnLabel || t(props.isWidget ? 'dock.return' : 'dock.widget')} disabled={props.isWidget ? !props.onReturnToTab : !props.canPopOut || !props.onPopOut}
          onClick={props.isWidget ? props.onReturnToTab : props.onPopOut}><DockIcon kind={props.isWidget ? 'return' : 'widget'} /></button>
        {props.nativeControls}
        {!props.isWidget && props.onDismiss && <button type="button" className="dock-icon-button" aria-label={t('dock.dismiss')} onClick={props.onDismiss}><DockIcon kind="close" /></button>}
        <AnimatePresence>
          {settingsOpen && <motion.div id={settingsId} className="dock-settings glass" role="dialog" aria-label={t('dock.settings')}
            initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.15 }}>
            {props.timerSettings && props.onTimerSettingsChange && <fieldset className="dock-timer-settings">
              <legend>{t('focus.timer.settings')}</legend>
              {props.onModeChange && <div className="dock-mode-switch">
                {(['focus', 'shortBreak', 'longBreak'] as const).map((mode) => <button type="button" key={mode}
                  aria-pressed={timerState.mode === mode} onClick={() => props.onModeChange?.(mode)}>{t(`focus.mode.${mode}`)}</button>)}
              </div>}
              {([
                ['focusMinutes', 'focusLength', 5, 180], ['shortBreakMinutes', 'shortBreakLength', 1, 60], ['longBreakMinutes', 'longBreakLength', 1, 90],
              ] as const).map(([key, label, min, max]) => <label key={key}>{t(`focus.timer.${label}`)}
                <input type="number" min={min} max={max} step="1" value={props.timerSettings![key]}
                  onChange={(event) => { const value = event.target.valueAsNumber;
                    if (Number.isFinite(value) && value >= min && value <= max) props.onTimerSettingsChange?.({ [key]: value }); }} />
              </label>)}
              {timerState.startedAt !== null && <p className="muted">{t('focus.timer.settingsApplyNext')}</p>}
            </fieldset>}
            <label>{t('dock.colors')}<select value={preferences.colorMode} onChange={(event) => preferences.setColorMode(event.target.value as typeof preferences.colorMode)}>
              {beatColorModes.map((value) => <option key={value} value={value}>{t(`dock.colors.${value}`)}</option>)}</select></label>
            <label>{t('dock.palette')}<select value={preferences.palette} onChange={(event) => preferences.setPalette(event.target.value as typeof preferences.palette)}>
              {beatPalettes.map((value) => <option key={value} value={value}>{t(`dock.palette.${value}`)}</option>)}</select></label>
            {props.onMusicSetup && <button type="button" onClick={props.onMusicSetup}>{t('music.installCompanion')}</button>}
          </motion.div>}
        </AnimatePresence>
      </div>

      <motion.div layout className="dock-layout dock-tabs" data-tab={activeTab} transition={{ layout: layoutTransition }}>
        <div className="dock-scaffold" aria-hidden="true" />
        <div className="dock-tabbar" role="tablist" aria-label={t('dock.style.tabs')}>
          <span className="dock-tab-pill" aria-hidden="true" style={{ transform: `translateX(${cards.indexOf(activeTab) * 100}%)` }} />
          {cards.map((card, index) => <button key={card} id={`${groupId}-${card}-tab`} type="button" role="tab" tabIndex={activeTab === card ? 0 : -1}
            aria-selected={activeTab === card} aria-controls={`${groupId}-${card}`} className={activeTab === card ? 'active' : ''}
            onClick={() => setTab(card)} onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % cards.length : event.key === 'ArrowLeft' ? (index + cards.length - 1) % cards.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : null;
              if (next === null) return;
              event.preventDefault(); setTab(cards[next]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }}>{card === 'focus' ? t('dock.tasks') : card === 'beat' ? t('dock.beatGrid') : t('focus.island.music')}</button>)}
        </div>
        <motion.section id={`${groupId}-timer`} layout layoutId="island-bar" className="dock-panel dock-focus-pane timer-island"
          data-card="focus" aria-label={t('focus.timer.pomodoro')} aria-hidden={hidden('focus')} inert={hidden('focus')}
          transition={{ layout: layoutTransition }}>
          <motion.div layout layoutId="session-row" className="dock-session-row" transition={{ layout: layoutTransition }}>
            {hasMusic && music.playing && <span className="music-dot playing" aria-hidden="true" />}
            <select className="dock-task-select task-select" aria-label={t('focus.timer.chooseTask')} value={taskId} disabled={!tasks.length || !onActiveTaskChange}
              onChange={(event) => onActiveTaskChange?.(event.target.value)}>
              {!tasks.length && <option value="">{t('home.focusEmptyTitle')}</option>}
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
            <span className="cycle">{cycle}/{cycleTotal}</span>
          </motion.div>
          <motion.div layout layoutId="timer-ring" className="dock-ring" transition={{ layout: layoutTransition }}>
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="dock-ring-track" cx="60" cy="60" r="54" />
              <circle className="dock-ring-progress" cx="60" cy="60" r="54" strokeDasharray={ringCircumference} strokeDashoffset={ringCircumference * (1 - progress)} /></svg>
            {props.onTimerSettingsChange ? <button ref={timeButtonRef} className="time dock-time-button" type="button" aria-label={t('focus.timer.settings')}
              title={t('focus.timer.settings')} aria-expanded={settingsOpen} aria-controls={settingsId}
              onClick={() => setSettingsOpen((current) => !current)}>{formatPomodoroTime(remainingSeconds)}</button>
              : <span className="time">{formatPomodoroTime(remainingSeconds)}</span>}
          </motion.div>
          <div className="dock-cycle">{modeLabel}</div>
          <div className="dock-focus-actions">
            <button type="button" className="solid dock-start" onClick={timerState.isRunning ? onPause : onStart}
              aria-label={timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{timerState.isRunning ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
              <span>{timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}</span></button>
            <button className="dock-reset" type="button" onClick={onReset}>{t('focus.timer.reset')}</button>
            <button className="dock-next" type="button" disabled={!taskId || !onMarkDoneAndNext || activeTask?.isDone} onClick={() => onMarkDoneAndNext?.(taskId)}>{t('floating.completeNext')}</button>
          </div>
        </motion.section>
        <div className="dock-now-playing" hidden={activeTab === 'music' || !music.playing}>
          {hasMusic && <MusicNowPlaying music={music} />}
        </div>
        <section id={`${groupId}-focus`} className="dock-panel dock-work-pane" role="tabpanel" aria-labelledby={`${groupId}-focus-tab`}
          tabIndex={0} hidden={activeTab !== 'focus'}>
          <p className="eyebrow">{t('dock.focusTasks')}</p>
          {tasks.length ? <ul className="dock-work-list">{tasks.map((task) => <li key={task.id} className={`dock-work-row${task.isDone ? ' done' : ''}`}>
            <button type="button" className="dock-work-check" aria-label={`${t('common.markDone')}: ${task.title}`}
              disabled={task.isDone || !onMarkDoneAndNext} onClick={() => onMarkDoneAndNext?.(task.id)}>
              {task.isDone && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
            </button>
            <button type="button" className="dock-work-task" disabled={!onActiveTaskChange} aria-pressed={task.id === taskId}
              onClick={() => onActiveTaskChange?.(task.id)}><span>{task.title}</span><small>{[task.boardTitle, task.listTitle].filter(Boolean).join(' · ')}</small></button>
            {task.id === taskId && !task.isDone && <span className="dock-work-current">{t('dock.currentTask')}</span>}
          </li>)}</ul> : <p className="dock-empty muted">{t('home.focusEmptyTitle')}</p>}
          {props.onReturnToTab && <button type="button" className="dock-plan-link" onClick={props.onReturnToTab}>{props.returnLabel || t('dock.openKora')} <span aria-hidden="true">→</span></button>}
        </section>
        <motion.section id={`${groupId}-beat`} layout layoutId="beat-grid" className={`dock-panel dock-beat-pane${preferences.palette === 'ultraviolet' ? ' ultraviolet' : ''}`}
          data-card="beat" aria-label={t('dock.beat')} aria-hidden={hidden('beat')} inert={hidden('beat')}
          role="tabpanel" aria-labelledby={`${groupId}-beat-tab`} tabIndex={0}
          animate={{ opacity: hidden('beat') ? 0 : 1 }} transition={{ ...layoutTransition, layout: layoutTransition }}>
          {hasMusic ? <MusicGrid music={music} colorMode={preferences.colorMode} palette={preferences.palette} />
            : <p className="dock-empty muted">{t('music.nothingPlaying')}</p>}
        </motion.section>
        <motion.section id={`${groupId}-music`} layout layoutId="music-row" className={`dock-panel dock-track-pane${preferences.palette === 'ultraviolet' ? ' ultraviolet' : ''}`}
          data-card="music" aria-label={t('focus.island.music')} aria-hidden={hidden('music')} inert={hidden('music')}
          role="tabpanel" aria-labelledby={`${groupId}-music-tab`} tabIndex={0}
          animate={{ opacity: hidden('music') ? 0 : 1 }} transition={{ ...layoutTransition, layout: layoutTransition }}>
          {hasMusic ? <><MusicTrack music={music} /><MusicFeedback music={music} /></> : <p className="dock-empty muted">{t('music.nothingPlaying')}</p>}
        </motion.section>
      </motion.div>
      <MusicSetup music={music} />
      {props.widgetError && <p className="widget-error muted" role="status">{props.widgetError}</p>}
    </main>
  </LayoutGroup>;
}
