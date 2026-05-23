import type { Dispatch, SetStateAction } from 'react';

import type { BoardDeleteItem, ITaskItem } from '../../types/task.type';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import {
  getChecklistProgress,
  getTaskLabelClass,
  stripTaskHtml,
} from '../../utils/taskCollections';
import DueDateBadge from '../atoms/DueDateBadge';

interface TaskCardProps {
  task: ITaskItem;
  listId: string;
  handleEditTask?: (task: ITaskItem) => void;
  setDeleteItem?: Dispatch<SetStateAction<BoardDeleteItem | null>>;
  isDragging?: boolean;
  isOverlay?: boolean;
  className?: string;
}

function TaskCard({
  task,
  listId,
  handleEditTask,
  setDeleteItem,
  isDragging = false,
  isOverlay = false,
  className = '',
}: TaskCardProps) {
  const priorityBadgeClass = getPriorityBadgeClass(task.priority);
  const descriptionPreview = stripTaskHtml(task.description);
  const checklistProgress = getChecklistProgress(task.checklistItems || []);

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 transition-[transform,box-shadow,opacity] duration-200 ${
        isOverlay
          ? 'scale-[1.02] shadow-2xl ring-1 ring-blue-100 cursor-grabbing'
          : isDragging
            ? 'opacity-35 shadow-sm'
            : 'cursor-grab hover:shadow-md'
      } ${className}`}
    >
      <div className="mb-2 flex items-start justify-between group">
        <div className="min-w-0 flex-1">
          {task.labels.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {task.labels.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getTaskLabelClass(label.color)}`}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 break-all text-base font-semibold text-gray-900">
              {task.title}
            </h3>
            {task.priority && priorityBadgeClass && (
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClass}`}>
                {task.priority}
              </span>
            )}
          </div>
        </div>
        {!isOverlay && (
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => handleEditTask?.(task)}
              className="ml-2 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
              title="Edit task"
            >
              <svg className="h-[1.25rem] w-[1.25rem]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M11.3 6.2H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11c1.1 0 2-1 2-2.1V11l-4 4.2c-.3.3-.7.6-1.2.7l-2.7.6c-1.7.3-3.3-1.3-3-3.1l.6-2.9c.1-.5.4-1 .7-1.3l3-3.1Z" clipRule="evenodd"></path>
                <path fillRule="evenodd" d="M19.8 4.3a2.1 2.1 0 0 0-1-1.1 2 2 0 0 0-2.2.4l-.6.6 2.9 3 .5-.6a2.1 2.1 0 0 0 .6-1.5c0-.2 0-.5-.2-.8Zm-2.4 4.4-2.8-3-4.8 5-.1.3-.7 3c0 .3.3.7.6.6l2.7-.6.3-.1 4.7-5Z" clipRule="evenodd"></path>
              </svg>
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setDeleteItem?.({ type: 'card', listId, cardId: task.id });
              }}
              className="ml-2 cursor-pointer text-gray-400 transition-colors hover:text-red-600"
              title="Delete task"
            >
              <svg className="h-[1.25rem] w-[1.25rem]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {task.image && (
        <img
          src={task.image}
          alt={task.title}
          className="mb-3 h-32 w-full rounded-lg object-cover"
        />
      )}

      <p className="mb-4 line-clamp-2 text-sm text-gray-600">
        {descriptionPreview}
      </p>

      {task.checklistItems.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
            <span>Checklist</span>
            <span>{checklistProgress.completed}/{checklistProgress.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${checklistProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {task.attachments.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m7.328-1.328a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
          </svg>
          <span>{task.attachments.length} attachment{task.attachments.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {task.assignees.map((assignee) => (
            <img
              key={assignee.name}
              src={assignee.avatar}
              alt={assignee.name}
              className="h-8 w-8 rounded-full border-2 border-white"
              title={assignee.name}
            />
          ))}
        </div>

        <DueDateBadge dueDate={task.dueDate} isDone={task.isDone} />
      </div>
    </div>
  );
}

export default TaskCard;
