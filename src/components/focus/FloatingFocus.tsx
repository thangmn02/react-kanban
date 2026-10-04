import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { FocusTask, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';
import { MusicFeedback, MusicGrid, MusicSetup, MusicTrack } from '../../features/music/MusicPlayer';
import { useBrowserMusic } from '../../features/music/useBrowserMusic';
import { useDockPreferences, dockStyles, beatColorModes, beatPalettes } from './useDockPreferences';
import { isNativeWidget } from '../../features/native/runtime';

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
  onPopOut?: () => void;
  onReturnToTab?: () => void;
  onDismiss?: () => void;
  isWidget?: boolean;
  canPopOut?: boolean;
  widgetError?: string;
  onLayoutChange?: (style: typeof dockStyles[number], expanded: boolean) => void;
  onDragStart?: () => void;
  nativeControls?: ReactNode;
  returnLabel?: string;
}

const ringCircumference = 2 * Math.PI * 54;
const glide = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
const deckSpring = { type: 'spring' as const, stiffness: 300, damping: 28 };
type Card = 'focus' | 'beat' | 'music';

// Inline Lucide ArrowRightLeft geometry keeps the swap control lightweight.
function DockIcon({ kind }: { kind: 'swap' | 'settings' | 'widget' | 'return' | 'close' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'swap' ? <><path d="m16 3 4 4-4 4M20 7H4m4 14-4-4 4-4M4 17h16" /></>
      : kind === 'settings' ? <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></>
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
  const [deckState, setDeckState] = useState<'stacked' | 'fanned' | 'solo'>('stacked');
  const [soloCard, setSoloCard] = useState<Card>('focus');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const dock = dockRef.current;
    const Observer = dock?.ownerDocument.defaultView?.ResizeObserver;
    if (!dock || !Observer) return;
    const observer = new Observer(([entry]) => setCompact(entry.contentRect.width <= 650));
    observer.observe(dock);
    return () => observer.disconnect();
  }, [props.isWidget]);
  useEffect(() => {
    if (!settingsOpen) return;
    const toolbar = toolbarRef.current;
    const owner = toolbar?.ownerDocument;
    const close = (event: PointerEvent) => { if (toolbar && !event.composedPath().includes(toolbar)) setSettingsOpen(false); };
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
  const style = preferences.style;
  const deck = hasMusic ? deckState : 'stacked';
  const onLayoutChange = props.onLayoutChange;
  useEffect(() => { onLayoutChange?.(style, deck === 'fanned'); }, [style, deck, onLayoutChange]);
  const cycle = Math.min((timerState.completedCycleFocus || 0) + 1, cycleTotal);
  const progress = Math.max(0, Math.min(1, remainingSeconds / Math.max(1, timerState.plannedSeconds || remainingSeconds || 1500)));
  const layoutTransition = reducedMotion ? { duration: 0 } : style === 'deck' ? deckSpring : glide;
  const activeTab = hasMusic ? tab : 'focus';
  const hidden = (card: Card) => style === 'tabs' ? card !== activeTab
    : style === 'deck' && hasMusic ? deck === 'stacked' ? card !== 'focus' : deck === 'solo' && card !== soloCard : false;
  const pose = (card: Card) => {
    if (style !== 'deck' || !hasMusic || deck === 'solo') return { x: 0, rotate: 0 };
    if (deck === 'fanned') return { x: 0, rotate: compact ? 0 : card === 'focus' ? -2 : card === 'music' ? 2 : 0 };
    return { x: card === 'beat' ? 8 : card === 'music' ? -8 : 0, rotate: card === 'beat' ? 2 : card === 'music' ? -2 : 0 };
  };
  const selectCard = (card: Card, event: MouseEvent) => {
    if (style !== 'deck' || deck === 'stacked' || (event.target as HTMLElement).closest('button, select, a')) return;
    if (deck === 'solo' && soloCard === card) setDeckState('fanned');
    else { setSoloCard(card); setDeckState('solo'); }
  };

  return <LayoutGroup id={groupId}>
    <main ref={dockRef} className="floating-focus glass" aria-label="Floating Focus" data-style={style}>
      <div className="dock-toolbar" ref={toolbarRef}>
        <span className="dock-style-name" data-tauri-drag-region={props.onDragStart ? true : undefined}
          onPointerDown={(event) => { if (event.button === 0) props.onDragStart?.(); }}>{t(`dock.style.${style}`)}</span>
        <button type="button" className="dock-icon-button" aria-label={t('dock.swap')} title={t('dock.swap')}
          onClick={() => preferences.setStyle(dockStyles[(dockStyles.indexOf(style) + 1) % dockStyles.length])}><DockIcon kind="swap" /></button>
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
            <label>{t('dock.style')}<select value={style} onChange={(event) => preferences.setStyle(event.target.value as typeof style)}>
              {dockStyles.map((value) => <option key={value} value={value}>{t(`dock.style.${value}`)}</option>)}</select></label>
            <label>{t('dock.colors')}<select value={preferences.colorMode} onChange={(event) => preferences.setColorMode(event.target.value as typeof preferences.colorMode)}>
              {beatColorModes.map((value) => <option key={value} value={value}>{t(`dock.colors.${value}`)}</option>)}</select></label>
            <label>{t('dock.palette')}<select value={preferences.palette} onChange={(event) => preferences.setPalette(event.target.value as typeof preferences.palette)}>
              {beatPalettes.map((value) => <option key={value} value={value}>{t(`dock.palette.${value}`)}</option>)}</select></label>
          </motion.div>}
        </AnimatePresence>
      </div>

      <motion.div layout className={`dock-layout dock-${style}`} data-state={deck} data-tab={activeTab} data-has-music={hasMusic} transition={{ layout: layoutTransition }}>
        {/* Only decorative scaffolding crossfades. Shared elements never remount on a style change. */}
        <AnimatePresence initial={false}>
          <motion.div key={style} className={`dock-scaffold scaffold-${style}`} aria-hidden="true"
            initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98, transition: { duration: reducedMotion ? 0 : 0.15 } }}
            transition={reducedMotion ? { duration: 0 } : glide} />
        </AnimatePresence>
        <div className="dock-tabbar" role="tablist" aria-label={t('dock.style.tabs')} hidden={style !== 'tabs'}>
          {(['focus', ...(hasMusic ? ['beat', 'music'] : [])] as Card[]).map((card) => <button key={card} type="button" role="tab"
            aria-selected={activeTab === card} aria-controls={`${groupId}-${card}`} className={activeTab === card ? 'active' : ''}
            onClick={() => setTab(card)}>{card === 'focus' ? t('focus.timer.pomodoro') : card === 'beat' ? t('dock.beat') : t('focus.island.music')}</button>)}
        </div>
        <motion.section id={`${groupId}-focus`} layout layoutId="island-bar" className="dock-panel dock-focus-pane timer-island"
          data-card="focus" aria-label={t('focus.timer.pomodoro')} aria-hidden={hidden('focus')} inert={hidden('focus')}
          animate={{ ...pose('focus'), opacity: hidden('focus') ? 0 : 1 }} transition={{ ...layoutTransition, layout: layoutTransition }} onClick={(event) => selectCard('focus', event)}>
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
            <span className="time">{formatPomodoroTime(remainingSeconds)}</span>
          </motion.div>
          <div className="dock-cycle">{modeLabel}</div>
          <div className="dock-focus-actions">
            <button type="button" className="solid dock-start" disabled={!tasks.length} onClick={timerState.isRunning ? onPause : onStart}
              aria-label={timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{timerState.isRunning ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
              <span>{timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}</span></button>
            <button className="dock-reset" type="button" onClick={onReset}>{t('focus.timer.reset')}</button>
            <button className="dock-next" type="button" disabled={!taskId || !onMarkDoneAndNext || activeTask?.isDone} onClick={() => onMarkDoneAndNext?.(taskId)}>{t('floating.completeNext')}</button>
          </div>
        </motion.section>
        {hasMusic && <motion.section id={`${groupId}-beat`} layout layoutId="beat-grid" className={`dock-panel dock-beat-pane${preferences.palette === 'ultraviolet' ? ' ultraviolet' : ''}`}
          data-card="beat" aria-label={t('dock.beat')} aria-hidden={hidden('beat')} inert={hidden('beat')}
          animate={{ ...pose('beat'), opacity: hidden('beat') ? 0 : 1 }} transition={{ ...layoutTransition, layout: layoutTransition }} onClick={(event) => selectCard('beat', event)}>
          <MusicGrid music={music} colorMode={preferences.colorMode} palette={preferences.palette} orientation={style === 'mixer' ? 'vertical' : 'horizontal'} />
        </motion.section>}
        {hasMusic && <motion.section id={`${groupId}-music`} layout layoutId="music-row" className={`dock-panel dock-track-pane${preferences.palette === 'ultraviolet' ? ' ultraviolet' : ''}`}
          data-card="music" aria-label={t('focus.island.music')} aria-hidden={hidden('music')} inert={hidden('music')}
          animate={{ ...pose('music'), opacity: hidden('music') ? 0 : 1 }} transition={{ ...layoutTransition, layout: layoutTransition }} onClick={(event) => selectCard('music', event)}>
          <MusicTrack music={music} /><MusicFeedback music={music} />
        </motion.section>}
        <div className="dock-deck-controls" hidden={style !== 'deck' || !hasMusic}>
          <button type="button" aria-label={t('dock.deck.toggle')} onClick={() => setDeckState((current) => current === 'stacked' ? 'fanned' : current === 'fanned' ? 'stacked' : 'fanned')}>⋯</button>
          {deck === 'fanned' && (['focus', 'beat', 'music'] as Card[]).map((card) => <button key={card} type="button" onClick={() => { setSoloCard(card); setDeckState('solo'); }}>
            {card === 'focus' ? t('focus.timer.pomodoro') : card === 'beat' ? t('dock.beat') : t('focus.island.music')}</button>)}
        </div>
      </motion.div>
      {!isNativeWidget() && <MusicSetup music={music} />}
      {props.widgetError && <p className="widget-error muted" role="status">{props.widgetError}</p>}
    </main>
  </LayoutGroup>;
}
