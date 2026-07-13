import { lazy, Suspense } from 'react';

import AddGroupDialog from '../components/organisms/dialog/AddGroupDialog';
import BoardActivityDialog from '../components/organisms/dialog/BoardActivityDialog';
import CreateBoardDialog from '../components/organisms/dialog/CreateBoardDialog';
import DeleteDialog from '../components/organisms/dialog/DeleteDialog';
import ProgressReportDialog from '../components/organisms/dialog/ProgressReportDialog';
import TaskDialog from '../components/organisms/dialog/TaskDialog';
import AppToastContainer from '../components/organisms/toast/AppToastContainer';
import CommandPalette from '../components/command/CommandPalette';
import FocusCompletionPrompt from '../components/focus/FocusCompletionPrompt';
import FocusDock from '../components/focus/FocusDock';
import FocusLaunchpadDialog from '../components/focus/FocusLaunchpadDialog';
import FocusLimitToast from '../components/focus/FocusLimitToast';
import ShutdownRitualDialog from '../features/today/components/ShutdownRitualDialog';
import TodayQuickPlanDialog from '../features/today/components/TodayQuickPlanDialog';
import type { AppUser, WorkspaceMember, WorkspaceSummary } from '../types/auth.type';
import type { useBoardPageController } from '../features/board/hooks/useBoardPageController';
import type { useBoardDialogState } from '../features/board/hooks/useBoardDialogState';
import type { useTaskEditorState } from '../features/task-editor/useTaskEditorState';
import type { FocusSessionValue } from '../features/focus/useFocusSessionController';
import type { useAppFocusIntegration } from '../features/focus/useAppFocusIntegration';
import type { usePlanningController } from '../features/today/hooks/usePlanningController';
import type { useCommandPaletteActions } from '../hooks/useCommandPaletteActions';
import { useI18n } from '../i18n';

const ArcanaRewardToast = lazy(() => import('../features/arcana/ArcanaRewardToast'));

interface Props {
  user: AppUser | null;
  workspace: WorkspaceSummary | null;
  workspaceMembers: WorkspaceMember[];
  workspaceId: string | null;
  board: ReturnType<typeof useBoardPageController>;
  boardDialogs: ReturnType<typeof useBoardDialogState>;
  taskEditor: ReturnType<typeof useTaskEditorState>;
  focus: FocusSessionValue;
  focusIntegration: ReturnType<typeof useAppFocusIntegration>;
  planning: ReturnType<typeof usePlanningController>;
  commandPalette: {
    isOpen: boolean;
    actions: ReturnType<typeof useCommandPaletteActions>;
    onClose: () => void;
  };
  arcanaReward: {
    isOpen: boolean;
    availableDraws: number;
    onDrawNow: () => void;
    onLater: () => void;
  };
  progressReport: { isOpen: boolean; onClose: () => void };
}

export default function AppOverlays(props: Props) {
  const { t } = useI18n();
  const { board, boardDialogs, taskEditor, focus, focusIntegration, planning } = props;
  return (
    <>
      <CommandPalette {...props.commandPalette} />
      <Suspense fallback={null}><ArcanaRewardToast {...props.arcanaReward} /></Suspense>
      <FocusLaunchpadDialog
        isOpen={Boolean(focus.focusLaunchTask)}
        task={focus.focusLaunchTask}
        mode={focus.timerState.mode}
        suggestedSeconds={focus.timerState.remainingSeconds}
        onClose={focus.closeFocusLaunchpad}
        onStart={focus.confirmFocusLaunch}
      />
      <FocusCompletionPrompt
        task={focus.focusCompletion?.task || null}
        session={focus.focusCompletion?.session || null}
        intention={focus.focusCompletion?.intention || ''}
        onMarkDone={focusIntegration.handleMarkDoneFromCompletion}
        onKeepWorking={focus.keepWorkingFromCompletion}
        onClose={focus.closeFocusCompletion}
      />
      <TaskDialog
        isOpen={taskEditor.isOpen}
        onClose={taskEditor.closeTaskDialog}
        taskData={taskEditor.state.mode === 'edit' ? taskEditor.state.editingTask : null}
        onSubmitTask={taskEditor.state.mode === 'edit' ? board.onSubmitEditTask : board.onSubmitCard}
        isFocusTask={taskEditor.state.editingTask ? focus.isFocusTask(taskEditor.state.editingTask.id) : false}
        onToggleFocusTask={taskEditor.state.editingTask ? () => focus.handleToggleFocusTask(taskEditor.state.editingTask!) : undefined}
        workspaceMembers={props.workspaceMembers}
        workspaceId={props.workspaceId}
      />
      {boardDialogs.quickPlanDialog.isOpen && props.user && (
        <TodayQuickPlanDialog
          isOpen
          onClose={boardDialogs.closeQuickPlanDialog}
          currentUser={props.user}
          activeWorkspace={props.workspace}
          focusTasks={focus.focusTasks}
          carryoverSummary={planning.carryoverSummary}
          onCarryYesterday={planning.handleCarryYesterday}
          onDismissCarryover={() => planning.setCarryoverSummary(null)}
          onToggleTodayFocus={focus.handleToggleFocusTaskFromToday}
          onOpenTask={planning.handleOpenTaskFromPlan}
          onStartFocus={planning.handleStartFocusFromPlan}
          onGoToBoard={planning.handleGoToBoardFromPlan}
          onFinishRitual={planning.handleFinishDailyRitual}
        />
      )}
      {board.deleteItem && (
        <DeleteDialog onSubmit={board.handleDeleteConfirm} onClose={() => board.setDeleteItem(null)}>
          Are you sure you want to delete this {board.deleteItem.type}?
        </DeleteDialog>
      )}
      {boardDialogs.groupDialog.isOpen && <AddGroupDialog onClose={boardDialogs.closeGroupDialog} onSubmitGroup={board.onSubmitList} />}
      {boardDialogs.boardDialog.isOpen && <CreateBoardDialog onClose={boardDialogs.closeCreateBoardDialog} onSubmitBoard={board.handleCreateBoard} />}
      <BoardActivityDialog isOpen={boardDialogs.activityDialog.isOpen} onClose={boardDialogs.closeActivityDialog} boardId={board.activeBoardId} />
      <FocusDock
        focusTasks={focus.focusTasks}
        activeTaskId={focus.activeFocusTaskId}
        isCollapsed={focus.isFocusDockCollapsed}
        timerState={focus.timerState}
        dailyFocusStats={focus.dailyFocusStats}
        remainingSeconds={focus.remainingSeconds}
        onCollapseChange={focus.setIsFocusDockCollapsed}
        onActiveTaskChange={focusIntegration.handleActiveTaskChange}
        onModeChange={focus.setMode}
        onStartTimer={focus.handleStartFocusTimer}
        onPauseTimer={focus.pauseTimer}
        onResetTimer={focus.resetTimer}
        onPopOutTimer={focusIntegration.handleOpenFloatingFocusTimer}
        onOpenShutdown={() => planning.setIsShutdownRitualOpen(true)}
        onOpenTask={focusIntegration.handleOpenFocusTask}
        onMarkDone={focusIntegration.handleMarkFocusTaskDone}
        onRemoveTask={focus.removeFocusTask}
        isPictureInPictureSupported={focusIntegration.isPictureInPictureSupported}
        isPictureInPictureOpen={focusIntegration.isPictureInPictureOpen}
      />
      <FocusLimitToast message={focus.limitMessage} onDismiss={focus.clearLimitMessage} />
      <ShutdownRitualDialog
        isOpen={planning.isShutdownRitualOpen}
        focusTasks={focus.focusTasks}
        dailyFocusStats={focus.dailyFocusStats}
        onClose={() => planning.setIsShutdownRitualOpen(false)}
        onComplete={planning.handleCompleteShutdownRitual}
      />
      <ProgressReportDialog
        isOpen={props.progressReport.isOpen}
        onClose={props.progressReport.onClose}
        boardTitle={board.activeBoardSummary?.title || t('common.untitledBoard')}
        boardData={board.boardData}
      />
      <AppToastContainer />
    </>
  );
}
