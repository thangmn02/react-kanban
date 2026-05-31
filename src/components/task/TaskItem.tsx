import { memo, useState, type Dispatch, type SetStateAction } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { BoardDeleteItem, ITaskItem } from '../../types/task.type';
import type { TaskAssignee } from '../../types/task.type';
import { mapWorkspaceMembersToAssignees, mockWorkspaceMembers } from '../../utils/workspaceMembers';
import type { WorkspaceMember } from '../../types/auth.type';
import { TASK_PRIORITIES } from '../../constants';
import { getPriorityBadgeClass, getPriorityDotClass } from '../../utils/taskMetadata';
import {
  getChecklistProgress,
  getTaskLabelClass,
  stripTaskHtml,
} from '../../utils/taskCollections';
import DueDateBadge from '../atoms/DueDateBadge';

interface TaskItemProps {
  task: ITaskItem;
  handleEditTask: (task: ITaskItem) => void;
  listId: string;
  setDeleteItem: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  isOverlay?: boolean;
  onUpdateTask: (taskId: string, fields: Partial<ITaskItem>) => Promise<void>;
  onToggleFocusTask: (task: ITaskItem) => void;
  isFocusTask: boolean;
  workspaceMembers?: WorkspaceMember[];
}

function TaskItem({
  task,
  handleEditTask,
  listId,
  setDeleteItem,
  isOverlay = false,
  onUpdateTask,
  onToggleFocusTask,
  isFocusTask,
  workspaceMembers = mockWorkspaceMembers,
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
  const descriptionPreview = stripTaskHtml(task.description);
  const checklistProgress = getChecklistProgress(task.checklistItems || []);
  const assigneeOptions: TaskAssignee[] = mapWorkspaceMembersToAssignees(workspaceMembers);

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
          className={`relative rounded-[1.35rem] border border-white/80 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.03] transition-[box-shadow,transform,border,background] duration-200 ${
            isOverlay
              ? 'cursor-grabbing'
              : 'cursor-pointer hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white hover:shadow-[0_18px_48px_rgba(15,23,42,0.13)] active:scale-[0.99] active:cursor-grabbing'
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
                    {TASK_PRIORITIES.map((p) => {
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
                          <span className={`w-2 h-2 rounded-full ${getPriorityDotClass(p)}`} />
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
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFocusTask(task);
                  }}
                  className={`ml-2 cursor-pointer rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                    isFocusTask
                      ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                  title={isFocusTask ? 'Remove from Focus Dock' : 'Add to Focus Dock'}
                  aria-pressed={isFocusTask}
                  aria-label={`${isFocusTask ? 'Remove from' : 'Add to'} Focus Dock: ${task.title}`}
                >
                  {isFocusTask ? 'Focus' : '+ Focus'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTask(task);
                  }}
                  className="ml-2 cursor-pointer rounded-xl p-1 text-gray-400 transition-colors hover:bg-slate-50 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  title="Edit task"
                  aria-label={`Edit task: ${task.title}`}
                >
                  <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteItem({ type: 'card', listId, cardId: task.id });
                  }}
                  className="ml-1 cursor-pointer rounded-xl p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  title="Delete task"
                  aria-label={`Delete task: ${task.title}`}
                >
                  <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Task Title */}
          {task.labels.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {task.labels.slice(0, 3).map((label) => (
                <span
                  key={label.id}
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getTaskLabelClass(label.color)}`}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          <h3 className="mb-1.5 line-clamp-2 break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] text-slate-950">
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
            <div className="mb-3 max-h-36 w-full overflow-hidden rounded-2xl bg-gray-100 shadow-inner">
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

          {(task.checklistItems.length > 0 || task.attachments.length > 0) && (
            <div className="mb-3.5 space-y-2">
              {task.checklistItems.length > 0 && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                    <span>Checklist</span>
                    <span>{checklistProgress.completed}/{checklistProgress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                      style={{ width: `${checklistProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {task.attachments.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-blue-700">
                  <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m7.328-1.328a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
                  </svg>
                  <span>{task.attachments.length} attachment{task.attachments.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}

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
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    title="Manage assignees"
                    aria-label="Manage assignees"
                    aria-haspopup="true"
                    aria-expanded={showAssigneeMenu}
                  >
                    <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
                      <div className="absolute bottom-9.5 left-0 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-xs font-medium shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                        <div className="font-bold text-gray-500 px-2 pb-1.5 border-b border-gray-100 mb-1">
                          Assign members
                        </div>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {assigneeOptions.map((member) => {
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
                    ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                    : 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
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
