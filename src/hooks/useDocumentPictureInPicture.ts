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
}

interface FloatingTimerSnapshot {
  activeTaskTitle: string;
  mode: PomodoroMode;
  isRunning: boolean;
  remainingSeconds: number;
  hasRunnableTimer: boolean;
}

const floatingTimerStyles = `
  :root {
    color-scheme: light;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: linear-gradient(145deg, #f8fbff 0%, #ffffff 50%, #eef6ff 100%);
    color: #0f172a;
  }

  .timer-shell {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px;
  }

  .eyebrow {
    margin: 0;
    color: #2563eb;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .title {
    margin: 8px 0 0;
    max-width: 310px;
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-row {
    align-items: center;
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .badge {
    border: 1px solid #dbeafe;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 9px;
  }

  .time {
    margin-top: 12px;
    font-size: 50px;
    font-weight: 750;
    letter-spacing: -0.08em;
    line-height: 0.95;
  }

  .actions {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr auto;
    margin-top: 16px;
  }

  button {
    border: 0;
    border-radius: 16px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    padding: 10px 12px;
  }

  button:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.22);
  }

  .primary {
    background: #0f172a;
    color: #ffffff;
  }

  .secondary {
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.82);
    color: #334155;
  }

  .close {
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.82);
    color: #64748b;
    padding-inline: 12px;
  }
`;

function createFloatingTimerMarkup(snapshot: FloatingTimerSnapshot) {
  const buttonLabel = snapshot.isRunning ? 'Pause' : 'Start';

  return `
    <main class="timer-shell" aria-label="Floating focus timer">
      <section>
        <p class="eyebrow">Floating Focus</p>
        <h1 class="title">${snapshot.activeTaskTitle}</h1>
        <div class="meta-row">
          <span class="badge">${POMODORO_MODE_LABELS[snapshot.mode]}</span>
          <span class="badge">${snapshot.isRunning ? 'Running' : 'Paused'}</span>
        </div>
        <div class="time" aria-live="polite">${formatPomodoroTime(snapshot.remainingSeconds)}</div>
      </section>

      <section class="actions" aria-label="Timer controls">
        <button class="primary" type="button" data-action="toggle" aria-label="${buttonLabel} focus timer">
          ${buttonLabel}
        </button>
        <button class="secondary" type="button" data-action="reset" aria-label="Reset focus timer">
          Reset
        </button>
        <button class="close" type="button" data-action="close" aria-label="Close floating focus timer">
          Close
        </button>
      </section>
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
}: UseDocumentPictureInPictureParams) {
  const pipWindowRef = useRef<Window | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
  const hasRunnableTimer = focusTasks.length > 0 || Boolean(timerState.activeTaskId);

  const snapshot = useMemo<FloatingTimerSnapshot>(() => ({
    activeTaskTitle: activeTask?.title || 'Focus session',
    mode: timerState.mode,
    isRunning: timerState.isRunning,
    remainingSeconds,
    hasRunnableTimer,
  }), [activeTask?.title, hasRunnableTimer, remainingSeconds, timerState.isRunning, timerState.mode]);

  const renderPictureInPicture = useCallback(() => {
    const pipWindow = pipWindowRef.current;

    if (!pipWindow || pipWindow.closed) {
      return;
    }

    pipWindow.document.body.innerHTML = createFloatingTimerMarkup(snapshot);

    const toggleButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="toggle"]');
    const resetButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="reset"]');
    const closeButton = pipWindow.document.querySelector<HTMLButtonElement>('[data-action="close"]');

    toggleButton?.addEventListener('click', () => {
      if (snapshot.isRunning) {
        onPause();
        return;
      }

      onStart();
    });

    resetButton?.addEventListener('click', onReset);
    closeButton?.addEventListener('click', () => pipWindow.close());
  }, [onPause, onReset, onStart, snapshot]);

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
      width: 380,
      height: 240,
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
