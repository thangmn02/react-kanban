import { translateNow } from '../i18n/context';
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
  GO_HOME: { id: 'go-home', get title() { return translateNow('command.goToHome'); }, get description() { return translateNow('command.openThePersonalDashboard'); }, shortcut: 'H', keywords: ['dashboard', 'my tasks', 'home'] },
  GO_TODAY: { id: 'go-today', get title() { return translateNow('command.goToToday'); }, get description() { return translateNow('command.openTheDailyFocusPlanningPage'); }, shortcut: 'T', keywords: ['today', 'my day', 'daily plan', 'focus plan'] },
  GO_BOARD: { id: 'go-board', get title() { return translateNow('command.goToBoard'); }, get description() { return translateNow('command.openTheActiveKoraBoard'); }, shortcut: 'B', keywords: ['kanban', 'board', 'columns'] },
  GO_CALENDAR: { id: 'go-calendar', get title() { return translateNow('command.goToCalendar'); }, get description() { return translateNow('command.openTheCalendarViewForDue'); }, shortcut: 'C', keywords: ['calendar', 'due dates', 'schedule'] },
  GO_TABLE: { id: 'go-table', get title() { return translateNow('command.goToTable'); }, get description() { return translateNow('command.compareAndOpenTasksInThe'); }, keywords: ['table', 'tasks', 'rows'] },
  GO_FOCUS: { id: 'go-focus', get title() { return translateNow('command.goToFocus'); }, get description() { return translateNow('command.openTasksMusicAndBeatGrid'); }, keywords: ['focus', 'music', 'beat', 'dock'] },
  QUICK_ADD_TASK: { id: 'quick-add-task', get title() { return translateNow('command.quickAddTask'); }, get description() { return translateNow('command.createATaskInTheFirst'); }, shortcut: 'N', keywords: ['new task', 'create task', 'card'] },
  PLAN_TODAYS_FOCUS: { id: 'plan-todays-focus', get title() { return translateNow('command.planTodaySFocus'); }, get description() { return translateNow('command.openTodayToChooseUpTo'); }, keywords: ['today', 'my day', 'focus', 'plan'] },
  NEW_LIST: { id: 'new-list', get title() { return translateNow('command.createList'); }, get description() { return translateNow('command.addANewColumnToThe'); }, keywords: ['new list', 'column', 'group'] },
  NEW_BOARD: { id: 'new-board', get title() { return translateNow('home.createBoard'); }, get description() { return translateNow('command.startAnotherBoardFromATemplate'); }, keywords: ['new board', 'template', 'project'] },
  FOCUS_BOARD_SEARCH: { id: 'focus-board-search', get title() { return translateNow('command.focusBoardSearch'); }, get description() { return translateNow('command.jumpToTaskSearchAndFilters'); }, shortcut: '/', keywords: ['search', 'filter', 'find', 'tasks'] },
  CLEAR_BOARD_FILTERS: { id: 'clear-board-filters', get title() { return translateNow('command.clearBoardFilters'); }, get description() { return translateNow('command.resetSearchPriorityAssigneeAndDue'); }, keywords: ['clear filters', 'reset search', 'show all tasks'] },
  FILTER_HIGH_PRIORITY: { id: 'filter-high-priority', get title() { return translateNow('command.showHighPriorityTasks'); }, get description() { return translateNow('command.filterTheBoardToHighPriority'); }, keywords: ['filter', 'priority', 'high', 'urgent'] },
  FILTER_DUE_TODAY: { id: 'filter-due-today', get title() { return translateNow('command.showTasksDueToday'); }, get description() { return translateNow('command.filterTheBoardToTasksDue'); }, keywords: ['filter', 'due today', 'deadline', 'today'] },
  OPEN_BOARD_ACTIVITY: { id: 'open-board-activity', get title() { return translateNow('command.openBoardActivity'); }, get description() { return translateNow('command.reviewTheAuditTrailForThe'); }, keywords: ['activity', 'audit', 'history', 'log'] },
  START_FOCUS_TIMER: { id: 'start-focus-timer', get title() { return translateNow('task.startFocus'); }, get description() { return translateNow('command.startPomodoroForTheActiveFocus'); }, keywords: ['focus', 'pomodoro', 'timer', 'start', 'session'] },
  VIEW_TODAY_FOCUS_STATS: { id: 'view-today-focus-stats', get title() { return translateNow('command.viewTodayFocusStats'); }, get description() { return translateNow('command.openTodayToReviewSessionsAnd'); }, keywords: ['focus', 'stats', 'today', 'minutes', 'sessions'] },
  OPEN_FOCUS_HISTORY: { id: 'open-focus-history', get title() { return translateNow('command.openFocusHistory'); }, get description() { return translateNow('command.openTheActiveFocusTaskTo'); }, keywords: ['focus', 'history', 'task detail', 'sessions'] },
  PAUSE_FOCUS_TIMER: { id: 'pause-focus-timer', get title() { return translateNow('command.pauseFocusTimer'); }, get description() { return translateNow('command.pauseTheCurrentFocusSession'); }, keywords: ['focus', 'pomodoro', 'timer', 'pause'] },
  RESET_FOCUS_TIMER: { id: 'reset-focus-timer', get title() { return translateNow('command.resetFocusTimer'); }, get description() { return translateNow('command.resetTheCurrentPomodoroMode'); }, keywords: ['focus', 'pomodoro', 'timer', 'reset'] },
  POP_OUT_FOCUS_TIMER: { id: 'pop-out-focus-timer', get title() { return translateNow('command.popOutFocusTimer'); }, get description() { return translateNow('command.openASmallFloatingTimerWindow'); }, keywords: ['focus', 'pomodoro', 'timer', 'floating', 'picture in picture'] },
} as const satisfies Record<string, CommandPaletteActionConfig>;
