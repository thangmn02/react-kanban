import type { BoardTaskItem } from './task.type';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

export interface FocusTask {
  id: string;
  boardId: string;
  boardTitle: string;
  listId?: string;
  listTitle?: string;
  title: string;
  priority?: BoardTaskItem['priority'];
  dueDate?: string;
  assigneeAvatar?: string;
  isDone?: boolean;
  repeatInterval?: BoardTaskItem['repeatInterval'];
}

export interface FocusTaskInput {
  task: BoardTaskItem;
  boardId: string;
  boardTitle: string;
  listId?: string;
  listTitle?: string;
}

export interface PomodoroTimerState {
  mode: PomodoroMode;
  activeTaskId: string | null;
  sessionTask?: FocusTask | null;
  sessionId?: string | null;
  isRunning: boolean;
  remainingSeconds: number;
  endsAt: number | null;
  startedAt: number | null;
  plannedSeconds: number | null;
  completedCycleFocus?: number;
}

export interface PomodoroTimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export type FocusSessionStatus = 'completed' | 'interrupted' | 'cancelled';

export interface FocusSessionLogInput {
  sessionId: string;
  workspaceId: string;
  boardId?: string | null;
  taskId?: string | null;
  userId: string;
  mode: PomodoroMode;
  status: FocusSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  plannedSeconds: number;
}

export interface FocusSessionSummary {
  id: string;
  workspaceId: string;
  boardId: string | null;
  taskId: string | null;
  userId: string;
  mode: PomodoroMode;
  status: FocusSessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  plannedSeconds: number;
  createdAt: string;
}

export interface DailyFocusStats {
  focusedMinutes: number;
  completedSessions: number;
  interruptedSessions: number;
  topTaskTitle: string | null;
}

export interface PomodoroSessionSnapshot {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  plannedSeconds: number;
}
