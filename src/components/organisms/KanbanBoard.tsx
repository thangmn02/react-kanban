import { memo, useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';

import TaskList from '../task/TaskList';
import TaskItem from '../task/TaskItem';
import TaskListOverlay from '../task/TaskListOverlay';
import EmptyState from '../atoms/EmptyState';
import type { BoardData, BoardDeleteItem, ITaskItem } from '../../types/task.type';
import type { WorkspaceMember } from '../../types/auth.type';
import { doesTaskMatchFilters } from '../../utils/taskFilters';


interface KanbanBoardFilters {
  searchQuery: string;
  priority: string;
  assignee: string;
  dueDate: string;
}

interface KanbanBoardUiState {
  openMenuId: string | null;
  toggleMenu: (listId: string | null) => void;
}

interface KanbanBoardHandlers {
  onEditTask: (task: ITaskItem) => void;
  onDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  onOpenAddTask: (listId: string) => void;
  onOpenAddGroup: () => void;
  onBoardPositionChange: (
    boardData: BoardData,
    changeType: 'list' | 'task',
    activity?: { taskId: string; description: string },
  ) => Promise<void>;
  onUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
  onToggleFocusTask: (task: ITaskItem) => void;
}

interface KanbanBoardProps {
  boardData: BoardData;
  filters: KanbanBoardFilters;
  ui: KanbanBoardUiState;
  handlers: KanbanBoardHandlers;
  isFocusTask: (taskId: string) => boolean;
  workspaceMembers?: WorkspaceMember[];
}

interface DragItemData {
  type: 'list' | 'task' | 'task-list';
  listId: string;
}

/**
 * Resolves the destination list id for a drag-over target, validating it against the
 * known board columns.
 *
 * Fallback order:
 * 1. Prefer the over-target's own `listId` when it matches a known column id.
 * 2. Otherwise fall back to `overId` itself when it matches a known column id
 *    (e.g. when dropping directly onto a list container).
 * 3. Return `null` when neither resolves to a valid, known column.
 */
function findValidDestinationListId(overId: string, overData: DragItemData | undefined, columnIds: string[]): string | null {
  if (overData?.listId && columnIds.includes(overData.listId)) {
    return overData.listId;
  }

  if (columnIds.includes(overId)) {
    return overId;
  }

  return null;
}

const MemoizedTaskList = memo(TaskList);
const MemoizedTaskItem = memo(TaskItem);
const MemoizedTaskListOverlay = memo(TaskListOverlay);

function KanbanBoard({
  boardData,
  filters,
  ui,
  handlers,
  isFocusTask,
  workspaceMembers,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'list' | 'task' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const collisionDetectionStrategy = useCallback<CollisionDetection>((collisionArgs) => {
    if (activeType === 'list') {
      const listDroppableContainers = collisionArgs.droppableContainers.filter((droppableContainer) => (
        droppableContainer.data.current?.type === 'list'
      ));

      return closestCorners({
        ...collisionArgs,
        droppableContainers: listDroppableContainers,
      });
    }

    const taskDroppableContainers = collisionArgs.droppableContainers.filter((droppableContainer) => {
      const droppableType = droppableContainer.data.current?.type;
      return droppableType === 'task' || droppableType === 'task-list';
    });

    return closestCorners({
      ...collisionArgs,
      droppableContainers: taskDroppableContainers,
    });
  }, [activeType]);

  const boardColumns = useMemo(() => (
    boardData.columns.map((columnId) => {
      const listItem = boardData.list[columnId];

      if (!listItem) {
        return null;
      }

      const allTasks = listItem.tasks
        .map(taskId => boardData.task[taskId])
        .filter((task): task is ITaskItem => Boolean(task));

      const displayTasks = allTasks.filter((task) => {
        return doesTaskMatchFilters(task, {
          searchQuery: filters.searchQuery,
          filterPriority: filters.priority,
          filterAssignee: filters.assignee,
          filterDueDate: filters.dueDate,
        });
      });

      return {
        columnId,
        listItem,
        allTasks,
        displayTasks,
      };
    }).filter((column): column is NonNullable<typeof column> => Boolean(column))
  ), [boardData, filters.searchQuery, filters.priority, filters.assignee, filters.dueDate]);

  const hasActiveFilters = Boolean(
    filters.searchQuery || filters.priority || filters.assignee || filters.dueDate
  );
  const hasAnyTasks = boardColumns.some((column) => column.allTasks.length > 0);
  const hasVisibleTasks = boardColumns.some((column) => column.displayTasks.length > 0);
  const showNoResults = hasActiveFilters && hasAnyTasks && !hasVisibleTasks;

  const handleDragStart = ({ active }: DragStartEvent) => {
    const activeData = active.data.current as DragItemData | undefined;
    setActiveId(active.id.toString());
    if (activeData) {
      setActiveType(activeData.type as 'list' | 'task');
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeData = active.data.current as DragItemData | undefined;
    const overData = over.data.current as DragItemData | undefined;

    if (!activeData || !overData) return;

    if (activeData.type === 'list') {
      const sourceListId = active.id.toString();
      const destinationListId = findValidDestinationListId(over.id.toString(), overData, boardData.columns);

      if (!destinationListId || sourceListId === destinationListId) {
        return;
      }

      const sourceIndex = boardData.columns.indexOf(sourceListId);
      const destinationIndex = boardData.columns.indexOf(destinationListId);

      if (sourceIndex === -1 || destinationIndex === -1 || sourceIndex === destinationIndex) {
        return;
      }

      void handlers.onBoardPositionChange({
        ...boardData,
        columns: arrayMove(boardData.columns, sourceIndex, destinationIndex)
      }, 'list');

      return;
    }

    if (activeData.type !== 'task') return;

    const sourceListId = activeData.listId;
    const destinationListId = overData.listId;

    if (!sourceListId || !destinationListId) return;

    const sourceList = boardData.list[sourceListId];
    const destinationList = boardData.list[destinationListId];
    const sourceIndex = sourceList.tasks.indexOf(active.id.toString());

    if (sourceIndex === -1) {
      return;
    }

    if (sourceListId === destinationListId) {
      const destinationIndex = overData.type === 'task'
        ? sourceList.tasks.indexOf(over.id.toString())
        : sourceList.tasks.length - 1;

      if (sourceIndex !== destinationIndex) {
        void handlers.onBoardPositionChange({
          ...boardData,
          list: {
            ...boardData.list,
            [sourceListId]: {
              ...sourceList,
              tasks: arrayMove(sourceList.tasks, sourceIndex, destinationIndex)
            }
          }
        }, 'task', {
          taskId: active.id.toString(),
          description: `Reordered task within "${sourceList.title}"`,
        });
      }

      return;
    }

    const newSourceTasks = [...sourceList.tasks];
    const newDestinationTasks = [...destinationList.tasks];

    newSourceTasks.splice(sourceIndex, 1);

    const destinationIndex = overData.type === 'task'
      ? newDestinationTasks.indexOf(over.id.toString())
      : newDestinationTasks.length;

    newDestinationTasks.splice(destinationIndex, 0, active.id.toString());

    void handlers.onBoardPositionChange({
      ...boardData,
      list: {
        ...boardData.list,
        [sourceListId]: {
          ...sourceList,
          tasks: newSourceTasks
        },
        [destinationListId]: {
          ...destinationList,
          tasks: newDestinationTasks
        }
      }
    }, 'task', {
      taskId: active.id.toString(),
      description: `Moved task from "${sourceList.title}" to "${destinationList.title}"`,
    });
  };

  return (
    <DndContext
      collisionDetection={collisionDetectionStrategy}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-canvas p-6">
        {showNoResults && (
          <div className="mb-4">
            <EmptyState
              title="No matching tasks"
              description="No tasks match your current search or filters. Try adjusting them."
              compact
            />
          </div>
        )}
        <SortableContext
          items={boardData.columns}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-start gap-5 overflow-x-auto pb-6 pt-1">
            {boardColumns.map(({ columnId, listItem, displayTasks }) => (
                <MemoizedTaskList
                  key={columnId}
                  listItem={listItem}
                  tasks={displayTasks}
                  toggleMenu={ui.toggleMenu}
                  openMenuId={ui.openMenuId}
                  handleEditTask={handlers.onEditTask}
                  setDeleteItem={handlers.onDeleteItem}
                  setIsModalOpen={() => handlers.onOpenAddTask(listItem.id)}
                  onUpdateTask={handlers.onUpdateTask}
                  onToggleFocusTask={handlers.onToggleFocusTask}
                  isFocusTask={isFocusTask}
                  workspaceMembers={workspaceMembers}
                />
            ))}

            <div className="w-80 flex-shrink-0">
              <button
                onClick={handlers.onOpenAddGroup}
                className="w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/60 py-9 text-sm font-semibold text-slate-500 shadow-card transition-[background,box-shadow,transform,color] hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:text-slate-700 hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              >
                + Add another group
              </button>
            </div>
          </div>
        </SortableContext>
      </div>

      {/* DragOverlay for Visual Ghost Representations */}
      <DragOverlay
        adjustScale={false}
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        }}
      >
        {activeId && activeType === 'list' && boardData.list[activeId] && (
          <div className="origin-center scale-[1.02] rotate-1 cursor-grabbing select-none opacity-95 shadow-[0_32px_90px_rgba(15,23,42,0.25)]">
            <MemoizedTaskListOverlay
              listItem={boardData.list[activeId]}
              tasks={boardData.list[activeId].tasks
                .map(id => boardData.task[id])
                .filter((task): task is ITaskItem => Boolean(task))}
            />
          </div>
        )}
        {activeId && activeType === 'task' && boardData.task[activeId] && (
          <div className="origin-center scale-[1.04] rotate-2 cursor-grabbing select-none opacity-95 shadow-[0_32px_90px_rgba(15,23,42,0.25)]">
            <MemoizedTaskItem
              task={boardData.task[activeId]}
              listId=""
              handleEditTask={() => {}}
              setDeleteItem={() => {}}
              isOverlay={true}
              onUpdateTask={handlers.onUpdateTask}
              onToggleFocusTask={() => {}}
              isFocusTask={false}
              workspaceMembers={workspaceMembers}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
