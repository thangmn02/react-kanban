import { memo, type Dispatch, type SetStateAction } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { BoardDeleteItem, IListItem, ITaskItem } from '../../types/task.type';
import Typography from '../atoms/Typography';
import TaskItem from './TaskItem';

interface TaskListProps {
  listItem: IListItem;
  tasks: ITaskItem[];
  toggleMenu: (listId: string | null) => void;
  handleEditTask: (task: ITaskItem) => void;
  openMenuId: string | null;
  setIsModalOpen: () => void;
  setDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  isOverlay?: boolean;
  onUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
}

function TaskList({
  listItem,
  tasks,
  toggleMenu,
  handleEditTask,
  openMenuId,
  setIsModalOpen,
  setDeleteItem,
  isOverlay = false,
  onUpdateTask,
}: TaskListProps) {
  const taskIds = tasks.map(task => task.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: listItem.id,
    disabled: isOverlay, // Disable sortable hooks inside the Overlay
    data: {
      type: 'list',
      listId: listItem.id,
    },
    transition: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const { setNodeRef: setTaskAreaNodeRef } = useDroppable({
    id: `task-list-${listItem.id}`,
    disabled: isOverlay,
    data: {
      type: 'task-list',
      listId: listItem.id,
    },
  });

  const style = isOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={`mr-6 w-80 flex-shrink-0 flex flex-col max-h-[85vh] rounded-xl bg-gray-50 border border-gray-200 p-4 transition-shadow duration-200 ${
        isDragging
          ? 'opacity-30 border-2 border-dashed border-gray-400 bg-gray-100 shadow-inner'
          : isOverlay
          ? 'shadow-2xl ring-1 ring-black/5'
          : 'hover:shadow-md'
      }`}
    >
      {/* Header Container */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        {/* Graggable Title Area */}
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className={`flex items-center space-x-2 flex-1 p-1 rounded-lg transition-colors select-none ${
            isOverlay ? 'cursor-grabbing' : 'cursor-grab hover:bg-gray-200/60 active:cursor-grabbing'
          }`}
          title="Drag to reorder list"
        >
          {/* Custom Grip Icon */}
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-12a2 2 0 10.001 4.001A2 2 0 0013 2zm0 6a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
          <Typography
            className="text-xs font-bold text-gray-700 uppercase tracking-wider flex-1 truncate"
            content={listItem.title}
            component="h2"
          />
          <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-sm">
            {tasks.length.toString()}
          </span>
        </div>

        {/* Dropdown Menu (Three-dot - strictly non-draggable) */}
        {!isOverlay && (
          <div className="relative shrink-0 ml-1">
            <button
              onClick={() => toggleMenu(listItem.id)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/80 rounded-md cursor-pointer transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {openMenuId === listItem.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => toggleMenu(null)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setDeleteItem({ type: 'list', listId: listItem.id });
                      toggleMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center"
                  >
                    Delete group
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tasks Sortable List Area */}
      <div className="flex-1 overflow-y-auto min-h-[40px] pr-1 -mr-1">
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={isOverlay ? undefined : setTaskAreaNodeRef}
            className="h-full"
          >
            <div className="space-y-3 pb-4">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  listId={listItem.id}
                  handleEditTask={handleEditTask}
                  setDeleteItem={setDeleteItem}
                  isOverlay={isOverlay}
                  onUpdateTask={onUpdateTask}
                />
              ))}
              {tasks.length === 0 && !isDragging && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <svg className="h-8 w-8 mb-1.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="text-xs">No tasks in list</span>
                </div>
              )}
            </div>
          </div>
        </SortableContext>
      </div>

      {/* Add New Task Button */}
      {!isOverlay && (
        <button
          onClick={setIsModalOpen}
          className="w-full py-2.5 mt-2 text-sm font-semibold text-gray-500 bg-white border border-gray-200 border-dashed rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          + Add new task
        </button>
      )}
    </div>
  );
}

export default memo(TaskList);
