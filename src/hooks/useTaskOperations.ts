import type { Dispatch, SetStateAction } from 'react';
import { notify } from '../components/organisms/toast/notify';

import { LIST_POSITION_STEP } from '../constants';
import { useI18n } from '../i18n';
import type {
  BoardData,
  BoardDeleteItem,
  ITaskItem,
  QuickPlanFormData,
  TaskDialogFormData,
} from '../types/task.type';
import { createActivity } from '../services/activity.service';
import { replaceTaskChecklistItems } from '../services/checklist.service';
import { replaceTaskLabels } from '../services/label.service';
import { deleteList, updateListPositions } from '../services/list.service';
import {
  createTask,
  deleteTask,
  deleteTasksByListId,
  restoreTask,
  updateTask,
  updateTaskPositions,
} from '../services/task.service';
import {
  buildTaskFieldUpdatePayload,
  buildTaskInsertPayload,
  buildTaskUpdatePayload,
} from '../utils/boardDataMapper';
import { showUndoToast } from '../components/organisms/toast/showUndoToast';

interface BoardChangeActivity {
  taskId: string;
  description: string;
}

export interface UseTaskOperationsParams {
  boardData: BoardData;
  setBoardData: Dispatch<SetStateAction<BoardData>>;
  activeBoardId: string | null;
  activeWorkspaceId: string | null;
  syncBoardCache: (boardId: string | null, boardData: BoardData) => void;
  setIsSavingBoard: Dispatch<SetStateAction<boolean>>;
  userId: string | undefined;
  deleteItem: BoardDeleteItem | null;
  setDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  editingTask: ITaskItem | null;
  activeListId: string | null;
  closeTaskDialog: () => void;
  refreshBoardData: (args?: { boardId?: string | null; showErrorToast?: boolean }) => Promise<void>;
  onTaskCompleted?: () => void;
}

export interface UseTaskOperationsResult {
  onSubmitCard: (formData: TaskDialogFormData) => Promise<void>;
  onSubmitQuickPlan: (formData: QuickPlanFormData) => Promise<void>;
  onSubmitEditTask: (formData: TaskDialogFormData) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
  handleBoardPositionChange: (
    nextBoardData: BoardData,
    changeType: 'list' | 'task',
    activity?: BoardChangeActivity,
  ) => Promise<void>;
}

/**
 * Shared diff core for position payloads. Builds a map of the previous location
 * for each entry id, derives the next entries, then keeps only the entries that
 * changed relative to their previous location.
 */
function buildChangedPositions<PreviousLocation, Entry extends { id: string }>(
  previousBoardData: BoardData,
  nextBoardData: BoardData,
  buildPreviousLocations: (board: BoardData) => Map<string, PreviousLocation>,
  buildNextEntries: (board: BoardData) => Entry[],
  hasChanged: (previousLocation: PreviousLocation | undefined, entry: Entry) => boolean,
): Entry[] {
  const previousLocations = buildPreviousLocations(previousBoardData);

  return buildNextEntries(nextBoardData).filter((entry) => (
    hasChanged(previousLocations.get(entry.id), entry)
  ));
}

const buildChangedTaskPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => (
  buildChangedPositions<{ listId: string; position: number }, { id: string; list_id: string; position: number }>(
    previousBoardData,
    nextBoardData,
    (board) => {
      const previousTaskLocations = new Map<string, { listId: string; position: number }>();

      board.columns.forEach((listId) => {
        board.list[listId]?.tasks.forEach((taskId, position) => {
          previousTaskLocations.set(taskId, {
            listId,
            position,
          });
        });
      });

      return previousTaskLocations;
    },
    (board) => board.columns.flatMap((listId) => (
      board.list[listId].tasks.map((taskId, position) => ({
        id: taskId,
        list_id: listId,
        position,
      }))
    )),
    (previousLocation, { list_id, position }) => (
      !previousLocation
      || previousLocation.listId !== list_id
      || previousLocation.position !== position
    ),
  )
);

const buildChangedListPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => (
  buildChangedPositions<number, { id: string; position: number }>(
    previousBoardData,
    nextBoardData,
    (board) => {
      const previousListPositions = new Map<string, number>();

      board.columns.forEach((listId, position) => {
        previousListPositions.set(listId, position * LIST_POSITION_STEP);
      });

      return previousListPositions;
    },
    (board) => board.columns.map((listId, position) => ({
      id: listId,
      position: position * LIST_POSITION_STEP,
    })),
    (previousPosition, { position }) => previousPosition !== position,
  )
);

export function useTaskOperations({
  boardData,
  setBoardData,
  activeBoardId,
  activeWorkspaceId,
  syncBoardCache,
  setIsSavingBoard,
  userId,
  deleteItem,
  setDeleteItem,
  editingTask,
  activeListId,
  closeTaskDialog,
  refreshBoardData,
  onTaskCompleted,
}: UseTaskOperationsParams): UseTaskOperationsResult {
  const { t } = useI18n();

  const onSubmitQuickPlan = async (formData: QuickPlanFormData) => {
    if (!activeBoardId || !formData.targetListId) return;

    const targetList = boardData.list[formData.targetListId];

    if (!targetList) {
      notify.error(t('toast.chooseValidTargetList'));
      return;
    }

    const plannedTasks = formData.titles.flatMap((title) => {
      if (formData.assignmentMode === 'per-assignee') {
        return formData.assignees.map((assignee) => ({
          title,
          assignees: [assignee],
        }));
      }

      return [{
        title,
        assignees: formData.assignees,
      }];
    });

    if (plannedTasks.length === 0) {
      notify.info(t('toast.addTaskTitleBeforeCreate'));
      return;
    }

    setIsSavingBoard(true);

    const sharedResource = formData.sharedResource?.trim();
    const description = sharedResource ? `Resource: ${sharedResource}` : '';
    let successCount = 0;
    let failureCount = 0;
    let firstErrorMessage = '';

    try {
      for (const [index, plannedTask] of plannedTasks.entries()) {
        try {
          const createdTask = await createTask({
            ...buildTaskInsertPayload({
              boardId: activeBoardId,
              listId: formData.targetListId,
              title: plannedTask.title,
              description,
              priority: formData.priority,
              dueDate: formData.dueDate,
              position: targetList.tasks.length + index,
              assignees: plannedTask.assignees,
            }),
            workspace_id: activeWorkspaceId ?? undefined,
            created_by: userId,
          });

          successCount += 1;

          try {
            await createActivity(createdTask.id, 'create', {
              description: `Created task "${plannedTask.title}" from Quick Plan`,
            }, undefined, undefined, {
              workspaceId: activeWorkspaceId,
              boardId: activeBoardId,
              actorId: userId,
            });
          } catch (activityError) {
            console.error('Failed to create Quick Plan activity:', activityError);
          }
        } catch (error) {
          failureCount += 1;
          if (!firstErrorMessage) {
            firstErrorMessage = error instanceof Error ? error.message : t('toast.unableCreateTasks');
          }
        }
      }

      await refreshBoardData();

      if (failureCount > 0) {
        notify.warning(
          t('toast.quickPlanPartial', {
            success: successCount,
            successPlural: successCount === 1 ? '' : 's',
            failure: failureCount,
            message: firstErrorMessage,
          }),
        );
        return;
      }

      notify.success(t('toast.quickPlanCreated', {
        count: successCount,
        plural: successCount === 1 ? '' : 's',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableFinishQuickPlan');
      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  };

  const onSubmitCard = async (formData: TaskDialogFormData) => {
    if (!activeListId || !activeBoardId) return;

    setIsSavingBoard(true);

    try {
      const createdTask = await createTask({
        ...buildTaskInsertPayload({
          boardId: activeBoardId,
          listId: activeListId,
          title: formData.title,
          description: formData.description || '',
          priority: formData.priority,
          startDate: formData.startDate,
          dueDate: formData.dueDate,
          position: boardData.list[activeListId].tasks.length,
          assignees: formData.assignees,
          attachments: formData.attachments,
          image: formData.image,
        }),
        workspace_id: activeWorkspaceId ?? undefined,
        created_by: userId,
      });

      await Promise.all([
        replaceTaskChecklistItems(createdTask.id, formData.checklistItems, activeWorkspaceId),
        replaceTaskLabels(createdTask.id, activeBoardId, formData.labels, activeWorkspaceId),
      ]);

      await createActivity(createdTask.id, 'create', {
        description: `Created task "${formData.title}"`,
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: activeBoardId,
        actorId: userId,
      });

      await refreshBoardData();
      closeTaskDialog();
      notify.success(t('toast.cardAdded'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableAddTask');

      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  };

  const onSubmitEditTask = async (formData: TaskDialogFormData) => {
    if (!editingTask || !activeBoardId) return;

    setIsSavingBoard(true);

    try {
      await updateTask(editingTask.id, buildTaskUpdatePayload({
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        assignees: formData.assignees,
        attachments: formData.attachments,
        image: formData.image,
      }));
      await Promise.all([
        replaceTaskChecklistItems(editingTask.id, formData.checklistItems, activeWorkspaceId),
        replaceTaskLabels(editingTask.id, activeBoardId, formData.labels, activeWorkspaceId),
      ]);

      const changes: string[] = [];
      if (formData.title !== editingTask.title) {
        changes.push(`changed title to "${formData.title}"`);
      }
      if ((formData.description || '') !== (editingTask.description || '')) {
        changes.push(`updated description`);
      }
      if (formData.priority !== editingTask.priority) {
        changes.push(`changed priority from "${editingTask.priority || 'None'}" to "${formData.priority || 'None'}"`);
      }
      if (formData.startDate !== editingTask.startDate) {
        changes.push(`changed start date to ${formData.startDate || 'none'}`);
      }
      if (formData.dueDate !== editingTask.dueDate) {
        changes.push(`changed due date to ${formData.dueDate || 'none'}`);
      }
      if ((formData.image || '') !== (editingTask.image || '')) {
        changes.push(`updated cover image`);
      }

      const prevAssignees = editingTask.assignees?.map(a => a.name).join(', ') || '';
      const nextAssignees = formData.assignees?.map(a => a.name).join(', ') || '';
      if (prevAssignees !== nextAssignees) {
        changes.push(`updated assignees to [${formData.assignees?.map(a => a.name).join(', ') || 'none'}]`);
      }
      if (JSON.stringify(formData.labels) !== JSON.stringify(editingTask.labels || [])) {
        changes.push(`updated labels`);
      }
      if (JSON.stringify(formData.attachments) !== JSON.stringify(editingTask.attachments || [])) {
        changes.push(`updated attachments`);
      }
      if (JSON.stringify(formData.checklistItems) !== JSON.stringify(editingTask.checklistItems || [])) {
        changes.push(`updated checklist`);
      }

      const description = changes.length > 0
        ? `Updated task: ${changes.join(', ')}`
        : 'Saved task details';

      await createActivity(editingTask.id, 'update', {
        description,
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: activeBoardId,
        actorId: userId,
      });

      await refreshBoardData();
      closeTaskDialog();
      notify.success(t('toast.taskUpdated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableUpdateTask');

      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    try {
      await restoreTask(taskId);
      await refreshBoardData();
      notify.success(t('toast.taskRestored'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableRestoreTask');
      notify.error(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;

    const previousBoardData = boardData;
    const itemToDelete = deleteItem;

    // Close modal immediately to prevent double-clicking and provide snappy UI
    setDeleteItem(null);
    setIsSavingBoard(true);

    // Optimistic UI updates
    setBoardData(prev => {
      if (itemToDelete.type === 'list') {
        const nextColumns = prev.columns.filter(id => id !== itemToDelete.listId);
        const nextList = { ...prev.list };
        delete nextList[itemToDelete.listId];

        const listToDel = prev.list[itemToDelete.listId];
        const tasksInList = listToDel?.tasks || [];
        const nextTask = { ...prev.task };
        tasksInList.forEach(taskId => {
          delete nextTask[taskId];
        });

        return {
          ...prev,
          columns: nextColumns,
          list: nextList,
          task: nextTask,
        };
      } else if (itemToDelete.cardId) {
        const nextTask = { ...prev.task };
        delete nextTask[itemToDelete.cardId];

        const nextList = { ...prev.list };
        Object.keys(nextList).forEach(listId => {
          const listObj = nextList[listId];
          if (listObj.tasks.includes(itemToDelete.cardId!)) {
            nextList[listId] = {
              ...listObj,
              tasks: listObj.tasks.filter(id => id !== itemToDelete.cardId),
            };
          }
        });

        return {
          ...prev,
          list: nextList,
          task: nextTask,
        };
      }
      return prev;
    });

    try {
      if (itemToDelete.type === 'list') {
        const listToDel = previousBoardData.list[itemToDelete.listId];
        const tasksInList = listToDel?.tasks || [];
        // create activity logs in parallel to speed up list deletion
        await Promise.all(
          tasksInList.map(async (taskId) => {
            const task = previousBoardData.task[taskId];
            if (task) {
              await createActivity(taskId, 'deleted', {
                description: `Task was deleted because its list "${listToDel.title}" was deleted.`,
              }, undefined, task.title, {
                workspaceId: activeWorkspaceId,
                boardId: activeBoardId,
                actorId: userId,
              });
            }
          })
        );
        await deleteTasksByListId(itemToDelete.listId);
        await deleteList(itemToDelete.listId);
      } else if (itemToDelete.cardId) {
        const task = previousBoardData.task[itemToDelete.cardId];
        if (task) {
          await createActivity(itemToDelete.cardId, 'deleted', {
            description: `Task was deleted.`,
          }, undefined, task.title, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: userId,
          });
        }
        await deleteTask(itemToDelete.cardId);
      }

      await refreshBoardData();

      if (itemToDelete.type === 'list') {
        notify.success(t('toast.listDeleted'));
      } else if (itemToDelete.cardId) {
        const deletedCardId = itemToDelete.cardId;
        showUndoToast(t('toast.taskDeleted'), () => {
          void handleRestoreTask(deletedCardId);
        });
      }
    } catch (error) {
      // Rollback optimistic update on error
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : t('toast.unableDeleteItem', { type: itemToDelete.type });
      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleBoardPositionChange = async (
    nextBoardData: BoardData,
    changeType: 'list' | 'task',
    activity?: BoardChangeActivity,
  ) => {
    const previousBoardData = boardData;

    setBoardData(nextBoardData);
    syncBoardCache(activeBoardId, nextBoardData);

    try {
      if (changeType === 'list') {
        const listPositions = buildChangedListPositionPayload(previousBoardData, nextBoardData);

        if (listPositions.length > 0) {
          await updateListPositions(listPositions);
        }
      } else {
        const taskPositions = buildChangedTaskPositionPayload(previousBoardData, nextBoardData);

        if (taskPositions.length > 0) {
          await updateTaskPositions(taskPositions);

          if (activity) {
            try {
              await createActivity(activity.taskId, 'move', {
                description: activity.description,
              }, undefined, undefined, {
                workspaceId: activeWorkspaceId,
                boardId: activeBoardId,
                actorId: userId,
              });
            } catch (activityError) {
              console.error('Failed to create move activity:', activityError);
            }
          }
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : t('toast.unableSaveDragDrop');
      notify.error(message);
    }
  };

  const handleUpdateTask = async (taskId: string, fields: Partial<ITaskItem>) => {
    const previousBoardData = boardData;

    // Instant local UI feedback (optimistic update)
    setBoardData(prev => {
      const task = prev.task[taskId];
      if (!task) return prev;
      return {
        ...prev,
        task: {
          ...prev.task,
          [taskId]: {
            ...task,
            ...fields,
          },
        },
      };
    });

    try {
      const payload = buildTaskFieldUpdatePayload(fields);

      await updateTask(taskId, payload);

      const originalTask = previousBoardData.task[taskId];
      if (originalTask) {
        if ('priority' in fields && fields.priority !== originalTask.priority) {
          await createActivity(taskId, 'priority_change', {
            description: `Changed priority from "${originalTask.priority || 'None'}" to "${fields.priority || 'None'}"`,
            field: 'priority',
            oldValue: originalTask.priority,
            newValue: fields.priority
          }, undefined, undefined, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: userId,
          });
        }
        if ('assignees' in fields) {
          const prevNames = originalTask.assignees?.map(a => a.name).join(', ') || 'none';
          const nextNames = fields.assignees?.map(a => a.name).join(', ') || 'none';
          if (prevNames !== nextNames) {
            await createActivity(taskId, 'assignee_change', {
              description: `Updated assignees to [${nextNames}]`,
              field: 'assignees',
              oldValue: originalTask.assignees,
              newValue: fields.assignees
            }, undefined, undefined, {
              workspaceId: activeWorkspaceId,
              boardId: activeBoardId,
              actorId: userId,
            });
          }
        }
        if ('isDone' in fields && fields.isDone !== originalTask.isDone) {
          await createActivity(taskId, 'status_change', {
            description: fields.isDone ? 'Marked task as completed' : 'Marked task as incompleted',
            field: 'isDone',
            oldValue: originalTask.isDone,
            newValue: fields.isDone
          }, undefined, undefined, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: userId,
          });

          if (fields.isDone) {
            onTaskCompleted?.();
          }
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);
      const message = error instanceof Error ? error.message : t('toast.unableUpdateTask');
      notify.error(message);
    }
  };

  return {
    onSubmitCard,
    onSubmitQuickPlan,
    onSubmitEditTask,
    handleDeleteConfirm,
    handleUpdateTask,
    handleBoardPositionChange,
  };
}
