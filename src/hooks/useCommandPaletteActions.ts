import { useMemo } from 'react';

import { COMMAND_PALETTE_ACTION_CONFIG } from '../constants';
import type { CommandPaletteAction } from '../types/command.type';
import type { FocusTask } from '../types/focus.type';
import type { BoardViewMode } from './useViewRouting';

export interface UseCommandPaletteActionsParams {
  setActiveViewWithPath: (view: BoardViewMode) => void;
  handleQuickAddTask: () => void;
  openGroupDialog: () => void;
  openCreateBoardDialog: () => void;
  handleStartFocusTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  handleOpenFloatingFocusTimer: () => void;
  handleOpenFocusTask: (task: FocusTask) => void | Promise<void>;
  activeFocusTask: FocusTask | null;
  isPictureInPictureSupported: boolean;
}

type CommandPaletteActionConfigEntry =
  (typeof COMMAND_PALETTE_ACTION_CONFIG)[keyof typeof COMMAND_PALETTE_ACTION_CONFIG];

// Assemble a runtime action from its static config plus its live `run` closure.
// `keywords` is copied into a mutable array because the config is declared `as const`.
const withRun = (
  config: CommandPaletteActionConfigEntry,
  run: () => void,
): CommandPaletteAction => ({
  ...config,
  keywords: [...config.keywords],
  run,
});

export function useCommandPaletteActions({
  setActiveViewWithPath,
  handleQuickAddTask,
  openGroupDialog,
  openCreateBoardDialog,
  handleStartFocusTimer,
  pauseTimer,
  resetTimer,
  handleOpenFloatingFocusTimer,
  handleOpenFocusTask,
  activeFocusTask,
  isPictureInPictureSupported,
}: UseCommandPaletteActionsParams): CommandPaletteAction[] {
  return useMemo<CommandPaletteAction[]>(() => [
    withRun(COMMAND_PALETTE_ACTION_CONFIG.GO_HOME, () => setActiveViewWithPath('home')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.GO_TODAY, () => setActiveViewWithPath('today')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.GO_BOARD, () => setActiveViewWithPath('board')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.GO_CALENDAR, () => setActiveViewWithPath('calendar')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.QUICK_ADD_TASK, handleQuickAddTask),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.PLAN_TODAYS_FOCUS, () => setActiveViewWithPath('today')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.NEW_LIST, () => {
      setActiveViewWithPath('board');
      openGroupDialog();
    }),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.NEW_BOARD, () => openCreateBoardDialog()),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.START_FOCUS_TIMER, handleStartFocusTimer),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.VIEW_TODAY_FOCUS_STATS, () => setActiveViewWithPath('today')),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.OPEN_FOCUS_HISTORY, () => {
      if (activeFocusTask) {
        void handleOpenFocusTask(activeFocusTask);
        return;
      }

      setActiveViewWithPath('today');
    }),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.PAUSE_FOCUS_TIMER, pauseTimer),
    withRun(COMMAND_PALETTE_ACTION_CONFIG.RESET_FOCUS_TIMER, resetTimer),
    ...(isPictureInPictureSupported
      ? [withRun(COMMAND_PALETTE_ACTION_CONFIG.POP_OUT_FOCUS_TIMER, handleOpenFloatingFocusTimer)]
      : []),
  ], [
    activeFocusTask,
    handleOpenFloatingFocusTimer,
    handleOpenFocusTask,
    handleQuickAddTask,
    handleStartFocusTimer,
    isPictureInPictureSupported,
    openCreateBoardDialog,
    openGroupDialog,
    pauseTimer,
    resetTimer,
    setActiveViewWithPath,
  ]);
}
