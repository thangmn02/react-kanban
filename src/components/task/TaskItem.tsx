import { memo, useState, type Dispatch, type SetStateAction } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { BoardDeleteItem, ITaskItem } from '../../types/task.type';
import type { TaskAssignee } from '../../types/task.type';
import { mapWorkspaceMembersToAssignees, mockWorkspaceMembers } from '../../utils/workspaceMembers';
import type { WorkspaceMember } from '../../types/auth.type';
import { TASK_PRIORITIES } from '../../constants';
import { getDueDateStatus, getPriorityBadgeClass, getPriorityDotClass } from '../../utils/taskMetadata';
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
  const dueStatus = getDueDateStatus(task.dueDate, task.isDone);
  const descriptionPreview = stripTaskHtml(task.description);
  const checklistProgress = getChecklistProgress(task.checklistItems || []);
  const assigneeOptions: TaskAssignee[] = mapWorkspaceMembersToAssignees(workspaceMembers);
  const hasTeamMembers = assigneeOptions.length > 1;
  const visibleLabels = task.labels.slice(0, 2);
  const hiddenLabelCount = Math.max(0, task.labels.length - visibleLabels.length);
  const shouldShowPriority = task.priority === 'High';
  const shouldShowDueDate = Boolean(task.dueDate) && dueStatus.status !== 'none';

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
          ? 'opacity-20 border border-dashed border-slate-300 bg-slate-50 rounded-xl shadow-inner min-h-[140px]'
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
          className={`group relative rounded-2xl border bg-white p-4 shadow-card ring-1 transition-[box-shadow,transform,border,background] duration-200 ${
            isFocusTask && !isOverlay
              ? 'border-sky-200 ring-sky-100'
              : 'border-slate-200/80 ring-slate-900/[0.02]'
          } ${
            isOverlay
              ? 'cursor-grabbing'
              : 'cursor-pointer hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md active:scale-[0.99] active:cursor-grabbing'
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {task.labels.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {visibleLabels.map((label) => (
                    <span
                      key={label.id}
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getTaskLabelClass(label.color)}`}
                    >
                      {label.name}
                    </span>
                  ))}
                  {hiddenLabelCount > 0 && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      +{hiddenLabelCount}
                    </span>
                  )}
                </div>
              )}

              <h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOverlay) {
                      handleEditTask(task);
                    }
                  }}
                  aria-label={`Open task: ${task.title}`}
                  className={`block w-full cursor-pointer rounded text-left line-clamp-2 break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                    task.isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'
                  }`}
                >
                  {task.title}
                </button>
              </h3>
            </div>

            <div className="flex shrink-0 items-start gap-1.5">
              {shouldShowPriority && task.priority && (
                <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOverlay) setShowPriorityMenu(!showPriorityMenu);
                  }}
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${priorityBadgeClass} ${
                    isOverlay ? '' : 'hover:ring-1 hover:ring-offset-1 hover:ring-slate-300'
                  }`}
                  title={isOverlay ? undefined : "Click to change priority"}
                  aria-label={`Change priority for ${task.title}`}
                >
                  {task.priority}
                </button>
                </div>
              )}

              {/* Inline Priority Floating Dropdown */}
              {showPriorityMenu && !isOverlay && shouldShowPriority && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    aria-hidden="true"
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPriorityMenu(false);
                    }}
                  />
                  <div className="absolute left-0 z-40 mt-1.5 w-32 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold shadow-md">
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
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
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

              {!isOverlay && !task.isDone && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFocusTask(task);
                  }}
                  className={`ml-2 cursor-pointer rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
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
              )}

              {/* Task card edit and delete options */}
              {!isOverlay && (
                <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTask(task);
                  }}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:pointer-events-none sm:opacity-0 sm:focus:pointer-events-auto sm:focus:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100"
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
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 sm:pointer-events-none sm:opacity-0 sm:focus:pointer-events-auto sm:focus:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100"
                  title="Delete task"
                  aria-label={`Delete task: ${task.title}`}
                >
                  <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                  </svg>
                </button>
                </>
              )}
            </div>
          </div>

          {/* Task Description */}
          {descriptionPreview && (
            <p className="mb-3 line-clamp-1 text-xs leading-relaxed text-slate-500">
              {descriptionPreview}
            </p>
          )}

          {/* Task Optional Image */}
          {task.image && (
            <div className="mb-3 max-h-24 w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
              <img
                src={task.image}
                alt={task.title}
                className="w-full object-cover"
                draggable={false}
              />
            </div>
          )}

          {/* Due Date Status Row */}
          {shouldShowDueDate && (
          <div className="mb-3">
            <DueDateBadge dueDate={task.dueDate} isDone={task.isDone} />
          </div>
          )}

          {(task.checklistItems.length > 0 || task.attachments.length > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
              {task.checklistItems.length > 0 && (
                <span className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 text-emerald-700">
                  Checklist {checklistProgress.completed}/{checklistProgress.total}
                </span>
              )}

              {task.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m7.328-1.328a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
                  </svg>
                  <span>{task.attachments.length} attachment{task.attachments.length !== 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="my-2.5 border-t border-slate-100" />

          {/* Task Footer: Assignees & Status */}
          <div className="flex items-center justify-between select-none">
            {/* Assignees Avatars list & Interactive Multi-assignment button */}
            <div className="flex items-center gap-1.5">
              {hasTeamMembers && (
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
              )}

              {/* Mini Multi-select Assignee circular button */}
              {!isOverlay && hasTeamMembers && (
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAssigneeMenu(!showAssigneeMenu);
                    }}
                  className="pointer-events-none flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 hover:opacity-100 focus:pointer-events-auto focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 group-hover:pointer-events-auto group-hover:opacity-100"
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
                        aria-hidden="true"
                        role="presentation"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAssigneeMenu(false);
                        }}
                      />
                      <div className="absolute bottom-9.5 left-0 z-40 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-xs font-medium shadow-md">
                        <div className="font-bold text-slate-500 px-2 pb-1.5 border-b border-slate-100 mb-1">
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
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300"
                              >
                                <div className="flex items-center gap-2">
                                  <img src={member.avatar} alt={member.name} className="h-5.5 w-5.5 rounded-full object-cover" />
                                  <span className="truncate">{member.name}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => {}} // Controlled purely by button click
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
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
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  task.isDone
                    ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                    : 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-pressed={task.isDone}
                aria-label={`${task.isDone ? 'Mark not done' : 'Mark done'}: ${task.title}`}
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
