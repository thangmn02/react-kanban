import { memo, type Dispatch, type SetStateAction } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { BoardDeleteItem, IListItem, ITaskItem } from '../../types/task.type';
import type { WorkspaceMember } from '../../types/auth.type';
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
  onToggleFocusTask: (task: ITaskItem) => void;
  isFocusTask: (taskId: string) => boolean;
  workspaceMembers?: WorkspaceMember[];
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
  onToggleFocusTask,
  isFocusTask,
  workspaceMembers,
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
      className={`mr-6 flex max-h-[85vh] w-80 flex-shrink-0 flex-col rounded-[1.75rem] border border-white/80 bg-white/70 p-4 shadow-[0_14px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.03] backdrop-blur-xl transition-[box-shadow,border,background,opacity] duration-200 ${
        isDragging
          ? 'border-2 border-dashed border-sky-300 bg-sky-50/70 opacity-35 shadow-inner'
          : isOverlay
          ? 'shadow-2xl ring-1 ring-sky-100'
          : 'hover:border-sky-100 hover:bg-white/86 hover:shadow-[0_22px_64px_rgba(15,23,42,0.12)]'
      }`}
    >
      {/* Header Container */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        {/* Graggable Title Area */}
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className={`flex flex-1 select-none items-center space-x-2 rounded-2xl p-2 transition-colors ${
            isOverlay ? 'cursor-grabbing' : 'cursor-grab hover:bg-slate-100/80 active:cursor-grabbing'
          }`}
          title="Drag to reorder list"
        >
          {/* Custom Grip Icon */}
          <svg className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-12a2 2 0 10.001 4.001A2 2 0 0013 2zm0 6a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
          <Typography
            className="flex-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-700"
            content={listItem.title}
            component="h2"
          />
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">
            {tasks.length.toString()}
          </span>
        </div>

        {/* Dropdown Menu (Three-dot - strictly non-draggable) */}
        {!isOverlay && (
          <div className="relative shrink-0 ml-1">
            <button
              onClick={() => toggleMenu(listItem.id)}
              className="cursor-pointer rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label={`List options: ${listItem.title}`}
              aria-haspopup="true"
              aria-expanded={openMenuId === listItem.id}
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {openMenuId === listItem.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => toggleMenu(null)}
                ></div>
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
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
            <div className="space-y-3.5 pb-4">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  listId={listItem.id}
                  handleEditTask={handleEditTask}
                  setDeleteItem={setDeleteItem}
                  isOverlay={isOverlay}
                  onUpdateTask={onUpdateTask}
                  onToggleFocusTask={onToggleFocusTask}
                  isFocusTask={isFocusTask(task.id)}
                  workspaceMembers={workspaceMembers}
                />
              ))}
              {tasks.length === 0 && !isDragging && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 py-8 text-gray-400">
                  <svg className="h-8 w-8 mb-1.5 opacity-50" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className="mt-2 w-full shrink-0 cursor-pointer rounded-2xl border border-dashed border-slate-200 bg-white/72 py-3 text-sm font-semibold text-slate-500 shadow-sm transition-[background,box-shadow,transform,color] hover:-translate-y-0.5 hover:bg-white hover:text-slate-700 hover:shadow-md active:scale-[0.99]"
        >
          + Add new task
        </button>
      )}
    </div>
  );
}

export default memo(TaskList);
