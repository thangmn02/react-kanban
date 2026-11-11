import QuickTaskEntry from '../components/organisms/dialog/QuickTaskEntry';
import { lazy, Suspense } from 'react';
import {openQuickNotes} from '../features/notes/quick-notes-events';

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
import FocusLimitToast from '../components/focus/FocusLimitToast';
import ShutdownRitualDialog from '../features/today/components/ShutdownRitualDialog';
import type { AppUser, WorkspaceMember, WorkspaceSummary } from '../types/auth.type';
import type { useBoardPageController } from '../features/board/hooks/useBoardPageController';
import type { useBoardDialogState } from '../features/board/hooks/useBoardDialogState';
import type { useTaskEditorState } from '../features/task-editor/useTaskEditorState';
import type { FocusSessionValue } from '../features/focus/useFocusSessionController';
import type { useAppFocusIntegration } from '../features/focus/useAppFocusIntegration';
import type { usePlanningController } from '../features/today/hooks/usePlanningController';
import type { useCommandPaletteActions } from '../hooks/useCommandPaletteActions';
import { useI18n } from '../i18n';
import { ARCANA_ENABLED, NOTES_PREVIEW_ENABLED } from '../constants/features';
import { isNativeWidget } from '../features/native/runtime';

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
  quickTask: { isOpen: boolean; initialTitle: string; onClose: () => void; onSave: (title: string) => Promise<boolean>; onMore: (title: string) => void; onFullFormClosed: () => void };
  isHomeFocusActive?: boolean;
  hideCompactFocusDock?: boolean;
  onOpenNativeDock?: () => void;
}

export default function AppOverlays(props: Props) {
  const { t } = useI18n();
  const { board, boardDialogs, taskEditor, focus, focusIntegration, planning } = props;
  return (
    <>
      {focusIntegration.floatingFocusPortal}
      <CommandPalette {...props.commandPalette} />
      {ARCANA_ENABLED && <Suspense fallback={null}><ArcanaRewardToast {...props.arcanaReward} /></Suspense>}
      <FocusCompletionPrompt
        task={focus.focusCompletion?.task || null}
        session={focus.focusCompletion?.session || null}
        nextStep={focus.focusCompletion?.intention || ''}
        onSaveNextStep={(text) => { if (focus.focusCompletion) focus.saveNextStep(focus.focusCompletion.task.id, text, { paused: true }); }}
        onMarkDone={() => { if (focus.focusCompletion) focus.clearNextStep(focus.focusCompletion.task.id); void focusIntegration.handleMarkDoneFromCompletion(); }}
        onKeepWorking={focus.keepWorkingFromCompletion}
        onClose={focus.closeFocusCompletion}
      />
      <QuickTaskEntry isOpen={props.quickTask.isOpen} onClose={props.quickTask.onClose} onSave={props.quickTask.onSave} onMore={props.quickTask.onMore} />
      <TaskDialog
        currentUser={props.user}
        initialTitle={taskEditor.state.mode === 'edit' ? undefined : props.quickTask.initialTitle}
        openCommentId={new URLSearchParams(window.location.search).get('comment')??undefined}
        isOpen={taskEditor.isOpen}
        onClose={() => { props.quickTask.onFullFormClosed(); taskEditor.closeTaskDialog(); }}
        onOpenNotes={NOTES_PREVIEW_ENABLED && props.user && taskEditor.state.editingTask ? () => openQuickNotes({taskId:taskEditor.state.editingTask!.id,boardId:board.activeBoardId??undefined}) : undefined}
        taskData={taskEditor.state.mode === 'edit' ? taskEditor.state.editingTask : null}
        onSubmitTask={taskEditor.state.mode === 'edit' ? board.onSubmitEditTask : board.onSubmitCard}
        isFocusTask={taskEditor.state.editingTask ? focus.isFocusTask(taskEditor.state.editingTask.id) : false}
        onToggleFocusTask={taskEditor.state.editingTask ? () => focus.handleToggleFocusTask(taskEditor.state.editingTask!) : undefined}
        onStartFocus={taskEditor.state.editingTask ? () => {
          const task = taskEditor.state.editingTask!;
          taskEditor.closeTaskDialog();
          focus.handleStartFocusTask(task);
        } : undefined}
        onToggleCompletion={taskEditor.state.editingTask ? async () => {
          const task = taskEditor.state.editingTask!;
          const saved = await board.handleTaskWorkflow(task.id, !task.isDone);
          if (saved) taskEditor.closeTaskDialog();
          return saved;
        } : undefined}
        workspaceMembers={props.workspaceMembers}
        workspaceId={props.workspaceId}
        boardTitle={board.activeBoardSummary?.title}
        columnTitle={Object.values(board.boardData.list).find((list) => taskEditor.state.mode === 'edit'
          ? list.tasks.includes(taskEditor.state.editingTask.id)
          : list.id === taskEditor.state.activeListId)?.title}
      />
      {board.deleteItem && (
        <DeleteDialog onSubmit={board.handleDeleteConfirm} onClose={() => board.setDeleteItem(null)}>
          {t('app.areYouSureYouWantTo')}{' '}{board.deleteItem.type}?
        </DeleteDialog>
      )}
      {boardDialogs.groupDialog.isOpen && <AddGroupDialog onClose={boardDialogs.closeGroupDialog} onSubmitGroup={board.onSubmitList} />}
      {boardDialogs.boardDialog.isOpen && <CreateBoardDialog onClose={boardDialogs.closeCreateBoardDialog} onSubmitBoard={board.handleCreateBoard} />}
      <BoardActivityDialog isOpen={boardDialogs.activityDialog.isOpen} onClose={boardDialogs.closeActivityDialog} boardId={board.activeBoardId} />
      {!props.hideCompactFocusDock && (!props.isHomeFocusActive || isNativeWidget()) && (
        <FocusDock
          showWhenEmpty={isNativeWidget()}
          focusTasks={focus.focusTasks}
          activeTaskId={focus.timerState.activeTaskId || focus.activeFocusTaskId}
          isCollapsed={focus.isFocusDockCollapsed}
          timerState={focus.timerState}
          timerSettings={focus.timerSettings}
          dailyFocusStats={focus.dailyFocusStats}
          remainingSeconds={focus.remainingSeconds}
          nextSteps={focus.nextSteps}
          onCollapseChange={focus.setIsFocusDockCollapsed}
          onActiveTaskChange={focusIntegration.handleActiveTaskChange}
          onModeChange={focus.setMode}
          onTimerSettingsChange={focus.updateTimerSettings}
          onStartTimer={() => focus.handleStartFocusTimer()}
          onPauseTimer={focus.pauseTimer}
          onResetTimer={focus.resetTimer}
          onPopOutTimer={props.onOpenNativeDock || focusIntegration.handleOpenFloatingFocusTimer}
          onOpenShutdown={() => planning.setIsShutdownRitualOpen(true)}
          onOpenTask={focusIntegration.handleOpenFocusTask}
          onMarkDone={focusIntegration.handleMarkFocusTaskDone}
          onRemoveTask={focus.removeFocusTask}
          isPictureInPictureSupported={Boolean(props.onOpenNativeDock) || focusIntegration.isPictureInPictureSupported}
          isPictureInPictureOpen={focusIntegration.isPictureInPictureOpen}
        />
      )}
      <FocusLimitToast message={focus.limitMessage} onDismiss={focus.clearLimitMessage} />
      <ShutdownRitualDialog
        isOpen={planning.isShutdownRitualOpen}
        focusTasks={focus.focusTasks}
        dailyFocusStats={focus.dailyFocusStats}
        nextSteps={focus.nextSteps}
        onSaveNextStep={(taskId, text) => focus.saveNextStep(taskId, text, { paused: true })}
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
