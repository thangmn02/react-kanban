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
import type { BoardData, BoardDeleteItem, ITaskItem } from '../../types/task.type';
import { doesTaskMatchFilters } from '../../utils/taskFilters';


interface KanbanBoardProps {
  boardData: BoardData;
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  openMenuId: string | null;
  toggleMenu: (listId: string | null) => void;
  handleEditTask: (task: ITaskItem) => void;
  setDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  onOpenAddTask: (listId: string) => void;
  onOpenAddGroup: () => void;
  onBoardDataChange: (
    boardData: BoardData,
    changeType: 'list' | 'task',
    activity?: { taskId: string; description: string },
  ) => Promise<void>;
  onUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
}

interface DragItemData {
  type: 'list' | 'task' | 'task-list';
  listId: string;
}

function resolveDestinationListId(overId: string, overData: DragItemData | undefined, columnIds: string[]): string | null {
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
  searchQuery,
  filterPriority,
  filterAssignee,
  filterDueDate,
  openMenuId,
  toggleMenu,
  handleEditTask,
  setDeleteItem,
  onOpenAddTask,
  onOpenAddGroup,
  onBoardDataChange,
  onUpdateTask,
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
          searchQuery,
          filterPriority,
          filterAssignee,
          filterDueDate,
        });
      });

      return {
        columnId,
        listItem,
        allTasks,
        displayTasks,
      };
    }).filter((column): column is NonNullable<typeof column> => Boolean(column))
  ), [boardData, searchQuery, filterPriority, filterAssignee, filterDueDate]);

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
      const destinationListId = resolveDestinationListId(over.id.toString(), overData, boardData.columns);

      if (!destinationListId || sourceListId === destinationListId) {
        return;
      }

      const sourceIndex = boardData.columns.indexOf(sourceListId);
      const destinationIndex = boardData.columns.indexOf(destinationListId);

      if (sourceIndex === -1 || destinationIndex === -1 || sourceIndex === destinationIndex) {
        return;
      }

      void onBoardDataChange({
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
        void onBoardDataChange({
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

    void onBoardDataChange({
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
      <div className="p-6">
        <SortableContext
          items={boardData.columns}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-start overflow-x-auto pb-4">
            {boardColumns.map(({ columnId, listItem, displayTasks }) => (
                <MemoizedTaskList
                  key={columnId}
                  listItem={listItem}
                  tasks={displayTasks}
                  toggleMenu={toggleMenu}
                  openMenuId={openMenuId}
                  handleEditTask={handleEditTask}
                  setDeleteItem={setDeleteItem}
                  setIsModalOpen={() => onOpenAddTask(listItem.id)}
                  onUpdateTask={onUpdateTask}
                />
            ))}

            <div className="w-80 flex-shrink-0">
              <button
                onClick={onOpenAddGroup}
                className="w-full cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white py-8 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
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
          <div className="scale-[1.02] rotate-1 shadow-2xl opacity-90 cursor-grabbing origin-center select-none">
            <MemoizedTaskListOverlay
              listItem={boardData.list[activeId]}
              tasks={boardData.list[activeId].tasks
                .map(id => boardData.task[id])
                .filter((task): task is ITaskItem => Boolean(task))}
            />
          </div>
        )}
        {activeId && activeType === 'task' && boardData.task[activeId] && (
          <div className="scale-[1.04] rotate-2 shadow-2xl opacity-95 cursor-grabbing origin-center select-none">
            <MemoizedTaskItem
              task={boardData.task[activeId]}
              listId=""
              handleEditTask={() => {}}
              setDeleteItem={() => {}}
              isOverlay={true}
              onUpdateTask={onUpdateTask}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
