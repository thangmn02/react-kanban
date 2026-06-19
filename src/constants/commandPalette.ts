// Static, serializable parts of each command palette action (NO `run` closures here —
// those stay in the hook because they capture component state/handlers).
export interface CommandPaletteActionConfig {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  keywords: string[];
}

export const COMMAND_PALETTE_ACTION_CONFIG = {
  GO_HOME: { id: 'go-home', title: 'Go to Home', description: 'Open the personal dashboard.', shortcut: 'H', keywords: ['dashboard', 'my tasks', 'home'] },
  GO_TODAY: { id: 'go-today', title: 'Go to Today', description: 'Open the daily focus planning page.', shortcut: 'T', keywords: ['today', 'my day', 'daily plan', 'focus plan'] },
  GO_BOARD: { id: 'go-board', title: 'Go to Board', description: 'Open the active Kanban board.', shortcut: 'B', keywords: ['kanban', 'board', 'columns'] },
  GO_CALENDAR: { id: 'go-calendar', title: 'Go to Calendar', description: 'Open the calendar view for due dates.', shortcut: 'C', keywords: ['calendar', 'due dates', 'schedule'] },
  QUICK_ADD_TASK: { id: 'quick-add-task', title: 'Quick add task', description: 'Create a task in the first list of the active board.', shortcut: 'N', keywords: ['new task', 'create task', 'card'] },
  PLAN_TODAYS_FOCUS: { id: 'plan-todays-focus', title: "Plan today's focus", description: 'Open Today to choose up to 3 focus tasks.', keywords: ['today', 'my day', 'focus', 'plan'] },
  NEW_LIST: { id: 'new-list', title: 'Create list', description: 'Add a new column to the active board.', keywords: ['new list', 'column', 'group'] },
  NEW_BOARD: { id: 'new-board', title: 'Create board', description: 'Start another board from a template.', keywords: ['new board', 'template', 'project'] },
  FOCUS_BOARD_SEARCH: { id: 'focus-board-search', title: 'Focus board search', description: 'Jump to task search and filters.', shortcut: '/', keywords: ['search', 'filter', 'find', 'tasks'] },
  CLEAR_BOARD_FILTERS: { id: 'clear-board-filters', title: 'Clear board filters', description: 'Reset search, priority, assignee, and due date filters.', keywords: ['clear filters', 'reset search', 'show all tasks'] },
  FILTER_HIGH_PRIORITY: { id: 'filter-high-priority', title: 'Show high priority tasks', description: 'Filter the board to high priority tasks.', keywords: ['filter', 'priority', 'high', 'urgent'] },
  FILTER_DUE_TODAY: { id: 'filter-due-today', title: 'Show tasks due today', description: 'Filter the board to tasks due today.', keywords: ['filter', 'due today', 'deadline', 'today'] },
  OPEN_BOARD_ACTIVITY: { id: 'open-board-activity', title: 'Open board activity', description: 'Review the audit trail for the active board.', keywords: ['activity', 'audit', 'history', 'log'] },
  START_FOCUS_TIMER: { id: 'start-focus-timer', title: 'Start focus session', description: 'Start Pomodoro for the active focus task.', keywords: ['focus', 'pomodoro', 'timer', 'start', 'session'] },
  VIEW_TODAY_FOCUS_STATS: { id: 'view-today-focus-stats', title: 'View today focus stats', description: 'Open Today to review sessions and focused minutes.', keywords: ['focus', 'stats', 'today', 'minutes', 'sessions'] },
  OPEN_FOCUS_HISTORY: { id: 'open-focus-history', title: 'Open focus history', description: 'Open the active focus task to review recent focus sessions.', keywords: ['focus', 'history', 'task detail', 'sessions'] },
  PAUSE_FOCUS_TIMER: { id: 'pause-focus-timer', title: 'Pause focus timer', description: 'Pause the current focus session.', keywords: ['focus', 'pomodoro', 'timer', 'pause'] },
  RESET_FOCUS_TIMER: { id: 'reset-focus-timer', title: 'Reset focus timer', description: 'Reset the current Pomodoro mode.', keywords: ['focus', 'pomodoro', 'timer', 'reset'] },
  POP_OUT_FOCUS_TIMER: { id: 'pop-out-focus-timer', title: 'Pop out focus timer', description: 'Open a small floating timer window.', keywords: ['focus', 'pomodoro', 'timer', 'floating', 'picture in picture'] },
} as const satisfies Record<string, CommandPaletteActionConfig>;
