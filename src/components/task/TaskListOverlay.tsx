import { memo } from 'react';

import type { IListItem, ITaskItem } from '../../types/task.type';
import Typography from '../atoms/Typography';
import TaskCard from './TaskCard';

interface TaskListOverlayProps {
  listItem: IListItem;
  tasks: ITaskItem[];
}

function TaskListOverlay({ listItem, tasks }: TaskListOverlayProps) {
  return (
    <div className="w-80 cursor-grabbing rounded-xl bg-white/95 p-1 shadow-2xl ring-1 ring-blue-100 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between px-3 pt-3">
        <div className="flex items-center space-x-2">
          <Typography
            className="text-sm font-semibold uppercase text-gray-700"
            content={listItem.title}
            component="h2"
          />
          <Typography
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500"
            content={listItem.tasks.length.toString()}
            component="span"
          />
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3">
        {tasks.slice(0, 2).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            listId={listItem.id}
            isOverlay
          />
        ))}

        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-sm text-gray-400">
            Empty list
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TaskListOverlay);
