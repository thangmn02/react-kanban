import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FocusTask, PomodoroMode, PomodoroTimerState } from '../types/focus.type';
import { formatPomodoroTime, POMODORO_MODE_LABELS } from '../utils/pomodoroTime';

interface UseDocumentPictureInPictureParams {
  activeTask: FocusTask | null;
  focusTasks: FocusTask[];
  timerState: PomodoroTimerState;
  remainingSeconds: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onActiveTaskChange?: (taskId: string) => void;
  onMarkDoneAndNext?: (taskId: string) => void;
}

interface FloatingTimerSnapshot {
  activeTaskId: string;
  focusTasks: Array<{ id: string; title: string }>;
  mode: PomodoroMode;
  isRunning: boolean;
  remainingSeconds: number;
  hasRunnableTimer: boolean;
}

const floatingTimerStyles = `
  :root {
    --bg-color: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.7);
    --border-color: rgba(255, 255, 255, 0.1);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --accent-color: #38bdf8;
    color-scheme: dark;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--bg-color);
    background-image: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 70%);
    color: var(--text-primary);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
  }

  .timer-shell {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 24px;
    padding: 20px 24px;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: relative;
  }

  .header {
    display: flex;
    flex-direction: column;
  }

  .eyebrow {
    margin: 0;
    color: var(--accent-color);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .task-switcher {
    margin: 8px 0 0;
    width: 100%;
    appearance: none;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    padding: 0;
    cursor: pointer;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .task-switcher:focus {
    outline: none;
    text-decoration: underline;
    text-decoration-color: var(--accent-color);
    text-underline-offset: 4px;
  }

  .task-switcher option {
    background: #1e293b;
    color: #f8fafc;
  }

  .meta-row {
    align-items: center;
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .badge {
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge.active {
    background: rgba(56, 189, 248, 0.1);
    color: var(--accent-color);
    border-color: rgba(56, 189, 248, 0.3);
  }

  .time {
    margin-top: auto;
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 2px 10px rgba(0,0,0,0.2);
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    margin-bottom: 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  button {
    border: 0;
    border-radius: 12px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    transition: all 0.2s;
  }

  button:active {
    transform: scale(0.96);
  }

  .primary {
    background: var(--text-primary);
    color: #0f172a;
  }

  .primary:hover {
    background: #e2e8f0;
  }

  .secondary {
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  .secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .complete-btn {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
    margin-left: auto;
  }

  .complete-btn:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  .footer {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
    opacity: 0.5;
  }
`;

function createFloatingTimerMarkup(snapshot: FloatingTimerSnapshot) {
  const buttonLabel = snapshot.isRunning ? 'Pause' : 'Start';

  const optionsHtml = snapshot.focusTasks.map(task => 
    `<option value="${task.id}" ${task.id === snapshot.activeTaskId ? 'selected' : ''}>${task.title}</option>`
  ).join('');

  return `
    <main class="timer-shell" aria-label="Floating focus timer">
      <section class="header">
        <p class="eyebrow">Floating Focus</p>
        <select class="task-switcher" data-action="switch" aria-label="Switch active focus task">
          ${optionsHtml}
        </select>
        <div class="meta-row">
          <span class="badge active">${POMODORO_MODE_LABELS[snapshot.mode]}</span>
          <span class="badge">${snapshot.isRunning ? 'Running' : 'Paused'}</span>
        </div>
        <div class="time" aria-live="polite">${formatPomodoroTime(snapshot.remainingSeconds)}</div>
      </section>

      <section class="controls" aria-label="Timer controls">
        <div class="actions">
          <button class="primary" type="button" data-action="toggle" aria-label="${buttonLabel} focus timer">
            ${buttonLabel}
          </button>
          <button class="secondary" type="button" data-action="reset" aria-label="Reset focus timer">
            Reset
          </button>
        </div>
        <button class="complete-btn" type="button" data-action="complete" aria-label="Mark done and next">
          Complete & Next
        </button>
      </section>
      <div class="footer">FOCUSED WITH KANBAN</div>
    </main>
  `;
}

export function useDocumentPictureInPicture({
  activeTask,
  focusTasks,
  timerState,
  remainingSeconds,
  onStart,
  onPause,
  onReset,
  onActiveTaskChange,
  onMarkDoneAndNext,
}: UseDocumentPictureInPictureParams) {
  const pipWindowRef = useRef<Window | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
  const hasRunnableTimer = focusTasks.length > 0 || Boolean(timerState.activeTaskId);

  const snapshot = useMemo<FloatingTimerSnapshot>(() => ({
    activeTaskId: activeTask?.id || '',
    focusTasks: focusTasks.map(t => ({ id: t.id, title: t.title })),
    mode: timerState.mode,
    isRunning: timerState.isRunning,
    remainingSeconds,
    hasRunnableTimer,
  }), [activeTask?.id, focusTasks, hasRunnableTimer, remainingSeconds, timerState.isRunning, timerState.mode]);

  const renderPictureInPicture = useCallback(() => {
    const pipWindow = pipWindowRef.current;

    if (!pipWindow || pipWindow.closed) {
      return;
    }

    pipWindow.document.body.innerHTML = createFloatingTimerMarkup(snapshot);

    const toggleButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="toggle"]');
    const resetButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="reset"]');
    const completeButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="complete"]');
    const switchSelect = pipWindow.document.querySelector<HTMLSelectElement>('[data-action="switch"]');

    toggleButton?.addEventListener('click', () => {
      if (snapshot.isRunning) {
        onPause();
        return;
      }

      onStart();
    });

    resetButton?.addEventListener('click', onReset);
    
    completeButton?.addEventListener('click', () => {
      if (snapshot.activeTaskId && onMarkDoneAndNext) {
        onMarkDoneAndNext(snapshot.activeTaskId);
      }
    });

    switchSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value && onActiveTaskChange) {
        onActiveTaskChange(target.value);
      }
    });
  }, [onPause, onReset, onStart, snapshot, onMarkDoneAndNext, onActiveTaskChange]);

  useEffect(() => {
    renderPictureInPicture();
  }, [renderPictureInPicture]);

  const openPictureInPicture = useCallback(async () => {
    if (!window.documentPictureInPicture) {
      throw new Error('Floating timer is not supported in this browser.');
    }

    if (!snapshot.hasRunnableTimer) {
      throw new Error('Pin a focus task before opening the floating timer.');
    }

    const existingWindow = pipWindowRef.current;

    if (existingWindow && !existingWindow.closed) {
      existingWindow.focus();
      return;
    }

    const nextWindow = await window.documentPictureInPicture.requestWindow({
      width: 400,
      height: 280,
    });

    pipWindowRef.current = nextWindow;
    setIsOpen(true);

    const styleElement = nextWindow.document.createElement('style');
    styleElement.textContent = floatingTimerStyles;
    nextWindow.document.head.appendChild(styleElement);
    nextWindow.document.title = 'Floating Focus Timer';
    nextWindow.addEventListener('pagehide', () => {
      pipWindowRef.current = null;
      setIsOpen(false);
    });

    renderPictureInPicture();
  }, [renderPictureInPicture, snapshot.hasRunnableTimer]);

  const closePictureInPicture = useCallback(() => {
    pipWindowRef.current?.close();
    pipWindowRef.current = null;
    setIsOpen(false);
  }, []);

  useEffect(() => () => {
    pipWindowRef.current?.close();
  }, []);

  return {
    isPictureInPictureSupported: isSupported,
    isPictureInPictureOpen: isOpen,
    openPictureInPicture,
    closePictureInPicture,
  };
}
