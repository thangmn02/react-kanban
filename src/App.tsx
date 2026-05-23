import { useEffect, useMemo, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { data } from './data';
import type { BoardData, BoardDeleteItem, ITaskItem } from './types/task.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import KanbanBoard from './components/organisms/KanbanBoard';
import TaskDialog from './components/organisms/dialog/TaskDialog';
import QuickSearch from './components/organisms/QuickSearch';
import { useTaskRealtime } from './hooks/useTaskRealtime';
import { fetchBoardSnapshot } from './services/board.service';
import { createList, deleteList, updateListPositions } from './services/list.service';
import {
  createTask,
  deleteTask,
  deleteTasksByListId,
  updateTask,
  updateTaskPositions,
} from './services/task.service';
import { readBoardCache, writeBoardCache } from './utils/boardCache';
import { buildTaskInsertPayload, buildTaskUpdatePayload } from './utils/boardDataMapper';
import { isLocalDemoMode } from './lib/supabase';
import { createActivity } from './services/activity.service';
import BoardActivityDialog from './components/organisms/dialog/BoardActivityDialog';


export interface TaskDialogFormData {
  title: string;
  description: string;
  priority?: ITaskItem['priority'];
  dueDate?: string;
  startDate?: string;
  assignees?: ITaskItem['assignees'];
}

function App() {
  const cachedBoard = useMemo(() => readBoardCache(), []);
  const [boardData, setBoardData] = useState<BoardData>(() => cachedBoard?.boardData || data);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => cachedBoard?.boardId || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isBoardActivityModalOpen, setIsBoardActivityModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<BoardDeleteItem | null>(null);
  const [editingTask, setEditingTask] = useState<ITaskItem | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [boardErrorMessage, setBoardErrorMessage] = useState<string | null>(null);

  const syncBoardCache = (nextBoardId: string | null, nextBoardData: BoardData) => {
    writeBoardCache({
      boardId: nextBoardId,
      boardData: nextBoardData,
    });
  };

  const refreshBoardData = async ({ showErrorToast = false }: { showErrorToast?: boolean } = {}) => {
    try {
      const boardSnapshot = await fetchBoardSnapshot();

      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
      setBoardErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch board data from Supabase.';

      setBoardErrorMessage(message);

      if (showErrorToast) {
        toast.error(message, { theme: 'colored' });
      }
    } finally {
      setIsBoardLoading(false);
    }
  };

  useEffect(() => {
    void refreshBoardData();
  }, []);

  useEffect(() => {
    syncBoardCache(activeBoardId, boardData);
  }, [activeBoardId, boardData]);

  useTaskRealtime({
    boardId: activeBoardId,
    setBoardData,
    refreshBoardData,
  });

  const buildChangedTaskPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => {
    const previousTaskLocations = new Map<string, { listId: string; position: number }>();

    previousBoardData.columns.forEach((listId) => {
      previousBoardData.list[listId]?.tasks.forEach((taskId, position) => {
        previousTaskLocations.set(taskId, {
          listId,
          position,
        });
      });
    });

    return nextBoardData.columns.flatMap((listId) => (
      nextBoardData.list[listId].tasks.map((taskId, position) => ({
        id: taskId,
        list_id: listId,
        position,
      }))
    )).filter(({ id, list_id, position }) => {
      const previousLocation = previousTaskLocations.get(id);

      return !previousLocation
        || previousLocation.listId !== list_id
        || previousLocation.position !== position;
    });
  };

  const buildChangedListPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => {
    const previousListPositions = new Map<string, number>();
    const normalizedListPositionStep = 1000;

    previousBoardData.columns.forEach((listId, position) => {
      previousListPositions.set(listId, position * normalizedListPositionStep);
    });

    return nextBoardData.columns.map((listId, position) => ({
      id: listId,
      position: position * normalizedListPositionStep,
    })).filter(({ id, position }) => previousListPositions.get(id) !== position);
  };

  const onSubmitList = async (formData: { title: string }) => {
    if (!activeBoardId) {
      toast.error('Board is not ready yet.', { theme: 'colored' });
      return;
    }

    setIsSavingBoard(true);

    try {
      await createList({
        board_id: activeBoardId,
        title: formData.title,
        position: boardData.columns.length,
      });

      await refreshBoardData();
      setIsGroupModalOpen(false);
      toast.success('List added successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add list.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const onSubmitCard = async (formData: TaskDialogFormData) => {
    if (!activeListId || !activeBoardId) return;

    setIsSavingBoard(true);

    try {
      const createdTask = await createTask(buildTaskInsertPayload({
        boardId: activeBoardId,
        listId: activeListId,
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        position: boardData.list[activeListId].tasks.length,
        assignees: formData.assignees,
      }));

      await createActivity(createdTask.id, 'create', {
        description: `Created task "${formData.title}"`,
      });

      await refreshBoardData();
      setIsModalOpen(false);
      setActiveListId(null);
      toast.success('Card added successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add task.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
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
              }, undefined, task.title);
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
          }, undefined, task.title);
        }
        await deleteTask(itemToDelete.cardId);
      }

      await refreshBoardData();
      toast.success(`${itemToDelete.type === 'list' ? 'List' : 'Card'} deleted successfully!`, { theme: 'colored' });
    } catch (error) {
      // Rollback optimistic update on error
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : `Unable to delete ${itemToDelete.type}.`;
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleEditTask = (task: ITaskItem) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const onSubmitEditTask = async (formData: TaskDialogFormData) => {
    if (!editingTask) return;

    setIsSavingBoard(true);

    try {
      await updateTask(editingTask.id, buildTaskUpdatePayload({
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        assignees: formData.assignees,
      }));

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

      const prevAssignees = editingTask.assignees?.map(a => a.name).join(', ') || '';
      const nextAssignees = formData.assignees?.map(a => a.name).join(', ') || '';
      if (prevAssignees !== nextAssignees) {
        changes.push(`updated assignees to [${formData.assignees?.map(a => a.name).join(', ') || 'none'}]`);
      }

      const description = changes.length > 0
        ? `Updated task: ${changes.join(', ')}`
        : 'Saved task details';

      await createActivity(editingTask.id, 'update', {
        description,
      });

      await refreshBoardData();
      setIsEditModalOpen(false);
      setEditingTask(null);
      toast.success('Task updated successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update task.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const toggleMenu = (listId: string | null) => {
    setOpenMenuId(openMenuId === listId ? null : listId);
  };

  const handleBoardDataChange = async (nextBoardData: BoardData, changeType: 'list' | 'task') => {
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
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : 'Unable to save drag and drop changes.';
      toast.error(message, { theme: 'colored' });
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
      const payload: any = {};
      if ('priority' in fields) payload.priority = fields.priority;
      if ('assignees' in fields) payload.assignees = fields.assignees;
      if ('isDone' in fields) payload.is_done = fields.isDone;

      await updateTask(taskId, payload);

      const originalTask = previousBoardData.task[taskId];
      if (originalTask) {
        if ('priority' in fields && fields.priority !== originalTask.priority) {
          await createActivity(taskId, 'priority_change', {
            description: `Changed priority from "${originalTask.priority || 'None'}" to "${fields.priority || 'None'}"`,
            field: 'priority',
            oldValue: originalTask.priority,
            newValue: fields.priority
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
            });
          }
        }
        if ('isDone' in fields && fields.isDone !== originalTask.isDone) {
          await createActivity(taskId, 'status_change', {
            description: fields.isDone ? 'Marked task as completed' : 'Marked task as incompleted',
            field: 'isDone',
            oldValue: originalTask.isDone,
            newValue: fields.isDone
          });
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      const message = error instanceof Error ? error.message : 'Unable to update task.';
      toast.error(message, { theme: 'colored' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">HVAC Editor</h1>
              {isLocalDemoMode && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  Local Demo Mode
                </span>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsBoardActivityModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Board Activity
              </button>
            </div>
          </div>
        </div>
      </nav>

      {(isBoardLoading || isSavingBoard) && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {isBoardLoading ? 'Loading board data from Supabase...' : 'Saving changes...'}
        </div>
      )}

      {boardErrorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center justify-between gap-4">
            <span>{boardErrorMessage}</span>
            <button
              type="button"
              onClick={() => {
                setIsBoardLoading(true);
                void refreshBoardData({ showErrorToast: true });
              }}
              className="cursor-pointer rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <QuickSearch
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterAssignee={filterAssignee}
        onFilterAssigneeChange={setFilterAssignee}
        filterDueDate={filterDueDate}
        onFilterDueDateChange={setFilterDueDate}
        onClearFilters={() => {
          setSearchQuery('');
          setFilterPriority('');
          setFilterAssignee('');
          setFilterDueDate('');
        }}
      />

      <KanbanBoard
        boardData={boardData}
        searchQuery={searchQuery}
        filterPriority={filterPriority}
        filterAssignee={filterAssignee}
        filterDueDate={filterDueDate}
        openMenuId={openMenuId}
        toggleMenu={toggleMenu}
        handleEditTask={handleEditTask}
        setDeleteItem={setDeleteItem}
        onBoardDataChange={handleBoardDataChange}
        onUpdateTask={handleUpdateTask}
        onOpenAddTask={(listId) => {
          setActiveListId(listId);
          setIsModalOpen(true);
        }}
        onOpenAddGroup={() => setIsGroupModalOpen(true)}
      />

      <TaskDialog
        isOpen={isModalOpen || isEditModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsEditModalOpen(false);
          setActiveListId(null);
          setEditingTask(null);
        }}
        taskData={isEditModalOpen ? editingTask : null}
        onSubmitTask={isEditModalOpen ? onSubmitEditTask : onSubmitCard}
      />

      {deleteItem && (
        <DeleteDialog
          onSubmit={handleDeleteConfirm}
          onClose={() => setDeleteItem(null)}
        >
          Are you sure you want to delete this {deleteItem.type}?
        </DeleteDialog>
      )}

      {isGroupModalOpen && (
        <AddGroupDialog
          onClose={() => setIsGroupModalOpen(false)}
          onSubmitGroup={onSubmitList}
        />
      )}

      <BoardActivityDialog
        isOpen={isBoardActivityModalOpen}
        onClose={() => setIsBoardActivityModalOpen(false)}
        boardId={activeBoardId}
      />

      <ToastContainer />
    </div>
  );
}

export default App;
