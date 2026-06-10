import { useEffect, useMemo, useState } from 'react';

import { TASK_PRIORITIES } from '../../../constants';
import type { BoardListMap, QuickPlanAssignmentMode, QuickPlanFormData, TaskAssignee } from '../../../types/task.type';
import type { WorkspaceMember } from '../../../types/auth.type';
import { mapWorkspaceMembersToAssignees } from '../../../utils/workspaceMembers';

interface QuickPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: QuickPlanFormData) => Promise<void>;
  lists: BoardListMap;
  listOrder: string[];
  initialListId: string | null;
  workspaceMembers: WorkspaceMember[];
  isSubmitting?: boolean;
}

function parseTaskLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assigneeKey(assignee: TaskAssignee) {
  return `${assignee.name}-${assignee.avatar}`;
}

export default function QuickPlanDialog({
  isOpen,
  onClose,
  onSubmit,
  lists,
  listOrder,
  initialListId,
  workspaceMembers,
  isSubmitting = false,
}: QuickPlanDialogProps) {
  const firstListId = listOrder.find((listId) => Boolean(lists[listId])) || '';
  const [targetListId, setTargetListId] = useState(initialListId || firstListId);
  const [taskLinesValue, setTaskLinesValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<TaskAssignee[]>([]);
  const [sharedResource, setSharedResource] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<QuickPlanAssignmentMode>('per-line');
  const [previousOpenContext, setPreviousOpenContext] = useState<{
    isOpen: boolean;
    initialListId: string | null;
    firstListId: string;
  } | null>(null);

  if (
    !previousOpenContext
    || previousOpenContext.isOpen !== isOpen
    || previousOpenContext.initialListId !== initialListId
    || previousOpenContext.firstListId !== firstListId
  ) {
    setPreviousOpenContext({ isOpen, initialListId, firstListId });

    if (isOpen) {
      setTargetListId(initialListId || firstListId);
      setTaskLinesValue('');
      setDueDate('');
      setPriority('');
      setSelectedAssignees([]);
      setSharedResource('');
      setAssignmentMode('per-line');
    }
  }

  const assigneeOptions = useMemo(() => mapWorkspaceMembersToAssignees(workspaceMembers), [workspaceMembers]);
  const taskTitles = useMemo(() => parseTaskLines(taskLinesValue), [taskLinesValue]);
  const selectedAssigneeNames = selectedAssignees.map((assignee) => assignee.name);
  const targetListTitle = lists[targetListId]?.title || 'No list selected';
  const isDuplicatePerAssignee = assignmentMode === 'per-assignee';
  const createdTaskCount = isDuplicatePerAssignee
    ? taskTitles.length * selectedAssignees.length
    : taskTitles.length;
  const hasValidTarget = Boolean(targetListId && lists[targetListId]);
  const isPerAssigneeDisabled = selectedAssignees.length === 0;
  const isSubmitDisabled = (
    isSubmitting
    || taskTitles.length === 0
    || !hasValidTarget
    || (isDuplicatePerAssignee && isPerAssigneeDisabled)
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const toggleAssignee = (assignee: TaskAssignee) => {
    setSelectedAssignees((currentAssignees) => {
      const key = assigneeKey(assignee);
      const isSelected = currentAssignees.some((currentAssignee) => assigneeKey(currentAssignee) === key);

      if (isSelected) {
        return currentAssignees.filter((currentAssignee) => assigneeKey(currentAssignee) !== key);
      }

      return [...currentAssignees, assignee];
    });
  };

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }

    void onSubmit({
      targetListId,
      titles: taskTitles,
      dueDate: dueDate || undefined,
      priority: priority as QuickPlanFormData['priority'],
      assignees: selectedAssignees,
      sharedResource: sharedResource.trim() || undefined,
      assignmentMode,
    }).then(() => {
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close Quick Plan"
        onClick={onClose}
      />

      <section
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]"
        aria-labelledby="quick-plan-title"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-600">Quick Plan</p>
              <h2 id="quick-plan-title" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Paste tasks, set defaults, create
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Batch-create normal tasks without changing your board structure.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Close Quick Plan"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div className="space-y-5">
              <div>
                <label htmlFor="quick-plan-list" className="mb-2 block text-sm font-semibold text-slate-700">
                  Target list
                </label>
                <select
                  id="quick-plan-list"
                  value={targetListId}
                  onChange={(event) => setTargetListId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  {listOrder.map((listId) => {
                    const list = lists[listId];
                    if (!list) return null;

                    return (
                      <option key={listId} value={listId}>
                        {list.title}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="quick-plan-titles" className="mb-2 block text-sm font-semibold text-slate-700">
                  Task titles
                </label>
                <textarea
                  id="quick-plan-titles"
                  value={taskLinesValue}
                  onChange={(event) => setTaskLinesValue(event.target.value)}
                  rows={8}
                  placeholder={'One task per line\nPrepare Canva creative\nWrite launch caption\nSchedule content review'}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Empty lines are ignored. Duplicate task titles are allowed.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="quick-plan-due-date" className="mb-2 block text-sm font-semibold text-slate-700">
                    Due date
                  </label>
                  <input
                    id="quick-plan-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label htmlFor="quick-plan-priority" className="mb-2 block text-sm font-semibold text-slate-700">
                    Priority
                  </label>
                  <select
                    id="quick-plan-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="">Use app default</option>
                    {TASK_PRIORITIES.map((taskPriority) => (
                      <option key={taskPriority} value={taskPriority}>
                        {taskPriority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="quick-plan-resource" className="mb-2 block text-sm font-semibold text-slate-700">
                  Shared resource link or note
                </label>
                <input
                  id="quick-plan-resource"
                  type="text"
                  value={sharedResource}
                  onChange={(event) => setSharedResource(event.target.value)}
                  placeholder="https://www.canva.com/design/..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Stored in each task description as plain text for now, not as an attachment.
                </p>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Assignment mode</h3>
                <div className="mt-3 grid gap-2">
                  <label className="flex cursor-pointer gap-3 rounded-2xl border border-white bg-white px-3 py-3 shadow-sm">
                    <input
                      type="radio"
                      checked={assignmentMode === 'per-line'}
                      onChange={() => setAssignmentMode('per-line')}
                      className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">One task per line</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        Selected assignees are attached to each task.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer gap-3 rounded-2xl border border-white bg-white px-3 py-3 shadow-sm">
                    <input
                      type="radio"
                      checked={assignmentMode === 'per-assignee'}
                      onChange={() => setAssignmentMode('per-assignee')}
                      disabled={isPerAssigneeDisabled}
                      className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Duplicate per assignee</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        Each created task has exactly one assignee.
                      </span>
                    </span>
                  </label>
                </div>
                {isPerAssigneeDisabled && (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Select at least one assignee to use duplicate-per-assignee mode.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Assignees</h3>
                <div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                  {assigneeOptions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-400">No members available.</p>
                  ) : (
                    assigneeOptions.map((assignee) => {
                      const key = assigneeKey(assignee);
                      const isSelected = selectedAssignees.some((selectedAssignee) => assigneeKey(selectedAssignee) === key);

                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <img src={assignee.avatar} alt={assignee.name} className="h-6 w-6 rounded-full object-cover" />
                            <span className="truncate">{assignee.name}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAssignee(assignee)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Creates</dt>
                    <dd className="font-semibold text-slate-900">{createdTaskCount} task{createdTaskCount === 1 ? '' : 's'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Target</dt>
                    <dd className="max-w-36 truncate font-semibold text-slate-900">{targetListTitle}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Due</dt>
                    <dd className="font-semibold text-slate-900">{dueDate || 'None'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Mode</dt>
                    <dd className="font-semibold text-slate-900">
                      {assignmentMode === 'per-line' ? 'Per line' : 'Per assignee'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Assignees</dt>
                    <dd className="max-w-40 truncate font-semibold text-slate-900">
                      {selectedAssigneeNames.length > 0 ? selectedAssigneeNames.join(', ') : 'None'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Resource</dt>
                    <dd className="font-semibold text-slate-900">{sharedResource.trim() ? 'Included' : 'No'}</dd>
                  </div>
                </dl>

                {assignmentMode === 'per-assignee' && selectedAssignees.length > 0 && (
                  <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                    {taskTitles.length} line{taskTitles.length === 1 ? '' : 's'} x {selectedAssignees.length} assignee{selectedAssignees.length === 1 ? '' : 's'} = {createdTaskCount} tasks.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Tasks append after existing tasks in the selected list.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : `Create ${createdTaskCount} task${createdTaskCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
