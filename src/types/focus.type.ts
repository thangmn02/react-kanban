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
  isRunning: boolean;
  remainingSeconds: number;
  endsAt: number | null;
}
