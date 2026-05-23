import { memo, useState, type Dispatch, type SetStateAction } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { BoardDeleteItem, ITaskItem } from '../../types/task.type';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';
import { AVAILABLE_ASSIGNEES } from '../organisms/QuickSearch';

interface TaskItemProps {
  task: ITaskItem;
  handleEditTask: (task: ITaskItem) => void;
  listId: string;
  setDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  isOverlay?: boolean;
  onUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
}

function TaskItem({
  task,
  handleEditTask,
  listId,
  setDeleteItem,
  isOverlay = false,
  onUpdateTask,
}: TaskItemProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isOverlay, // Disable sortable hooks inside the Overlay representation
    data: {
      type: 'task',
      listId,
    },
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const priorityBadgeClass = getPriorityBadgeClass(task.priority);
  const descriptionPreview = (() => {
    if (typeof window === 'undefined') {
      return task.description.replace(/<[^>]*>/g, ' ').trim();
    }

    const descriptionDocument = new DOMParser().parseFromString(task.description, 'text/html');
    return descriptionDocument.body.textContent?.trim() || '';
  })();

  const style = isOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={`relative select-none ${
        isDragging
          ? 'opacity-20 border border-dashed border-gray-400 bg-gray-50 rounded-xl shadow-inner min-h-[140px]'
          : isOverlay
          ? 'shadow-2xl ring-1 ring-black/5'
          : ''
      }`}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
    >
      {!isDragging && (
        <div
          onClick={() => {
            if (!isOverlay) {
              handleEditTask(task);
            }
          }}
          className={`bg-white border border-gray-200 rounded-xl p-4 transition-shadow relative ${
            isOverlay
              ? 'cursor-grabbing'
              : 'cursor-pointer hover:shadow-md active:cursor-grabbing'
          }`}
        >
          {/* Top Line: Priority (Dropdown) & Action Buttons */}
          <div className="flex items-start justify-between mb-2">
            {/* Priority Badge with Inline Select */}
            <div className="relative shrink-0">
              {task.priority ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOverlay) setShowPriorityMenu(!showPriorityMenu);
                  }}
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase transition-all duration-150 cursor-pointer ${priorityBadgeClass} ${
                    isOverlay ? '' : 'hover:ring-1 hover:ring-offset-1 hover:ring-gray-300'
                  }`}
                  title={isOverlay ? undefined : "Click to change priority"}
                >
                  {task.priority}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOverlay) setShowPriorityMenu(!showPriorityMenu);
                  }}
                  className="inline-flex shrink-0 rounded-full bg-gray-100 text-gray-500 px-2.5 py-0.5 text-[11px] font-medium transition-all duration-150 cursor-pointer hover:bg-gray-200"
                  title="Click to add priority"
                >
                  Set Priority
                </button>
              )}

              {/* Inline Priority Floating Dropdown */}
              {showPriorityMenu && !isOverlay && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPriorityMenu(false);
                    }}
                  />
                  <div className="absolute left-0 mt-1.5 w-32 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-30 text-xs font-semibold">
                    {(['High', 'Medium', 'Low', 'Lowest'] as const).map((p) => {
                      const isActive = task.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowPriorityMenu(false);
                            await onUpdateTask(task.id, { priority: p });
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            p === 'High' ? 'bg-red-500' : p === 'Medium' ? 'bg-amber-500' : p === 'Low' ? 'bg-emerald-500' : 'bg-gray-400'
                          }`} />
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Task card edit and delete options */}
            {!isOverlay && (
              <div className="flex items-center shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTask(task);
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-gray-50"
                  title="Edit task"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteItem({ type: 'card', listId, cardId: task.id });
                  }}
                  className="ml-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-red-50"
                  title="Delete task"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Task Title */}
          <h3 className="text-[15px] font-bold text-gray-900 mb-1.5 break-words line-clamp-2 leading-snug">
            {task.title}
          </h3>

          {/* Task Description */}
          {descriptionPreview && (
            <p className="text-xs text-gray-500 mb-3.5 line-clamp-2 leading-relaxed">
              {descriptionPreview}
            </p>
          )}

          {/* Task Optional Image */}
          {task.image && (
            <div className="w-full max-h-36 overflow-hidden rounded-lg mb-3 shadow-inner bg-gray-100">
              <img
                src={task.image}
                alt={task.title}
                className="w-full object-cover"
                draggable={false}
              />
            </div>
          )}

          {/* Due Date Status Row */}
          <div className="mb-3.5">
            <DueDateBadge dueDate={task.dueDate} isDone={task.isDone} />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 my-2.5" />

          {/* Task Footer: Assignees & Status */}
          <div className="flex items-center justify-between select-none">
            {/* Assignees Avatars list & Interactive Multi-assignment button */}
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5 overflow-hidden">
                {(task.assignees || []).map((assignee, index) => (
                  <img
                    key={index}
                    src={assignee.avatar}
                    alt={assignee.name}
                    className="w-7 h-7 rounded-full border-2 border-white object-cover"
                    title={assignee.name}
                    draggable={false}
                  />
                ))}
              </div>

              {/* Mini Multi-select Assignee circular button */}
              {!isOverlay && (
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAssigneeMenu(!showAssigneeMenu);
                    }}
                    className="h-7 w-7 rounded-full border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    title="Manage assignees"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  {showAssigneeMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAssigneeMenu(false);
                        }}
                      />
                      <div className="absolute left-0 bottom-9.5 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 p-2 z-30 text-xs font-medium">
                        <div className="font-bold text-gray-500 px-2 pb-1.5 border-b border-gray-100 mb-1">
                          Assign members
                        </div>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {AVAILABLE_ASSIGNEES.map((member) => {
                            const isAssigned = (task.assignees || []).some(a => a.name === member.name);
                            return (
                              <button
                                key={member.name}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  let newAssignees = [...(task.assignees || [])];
                                  if (isAssigned) {
                                    newAssignees = newAssignees.filter(a => a.name !== member.name);
                                  } else {
                                    newAssignees.push({ name: member.name, avatar: member.avatar });
                                  }
                                  await onUpdateTask(task.id, { assignees: newAssignees });
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <img src={member.avatar} alt={member.name} className="h-5.5 w-5.5 rounded-full object-cover" />
                                  <span className="truncate">{member.name}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => {}} // Controlled purely by button click
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Done Switcher */}
            {!isOverlay && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await onUpdateTask(task.id, { isDone: !task.isDone });
                }}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
                  task.isDone
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                {task.isDone ? 'Done ✓' : 'Mark Done'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TaskItem);
