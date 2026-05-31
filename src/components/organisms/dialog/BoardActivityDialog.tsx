import { useEffect, useState } from 'react';
import ContentDialog from '../../molecules/dialog/ContentDialog';
import type { ITaskActivity } from '../../../types/task.type';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fetchBoardActivities } from '../../../services/activity.service';

interface BoardActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string | null;
}

function BoardActivityDialog({ isOpen, onClose, boardId }: BoardActivityDialogProps) {
  const [activities, setActivities] = useState<ITaskActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBoardActivities = async (currentBoardId: string) => {
    setIsLoading(true);

    try {
      const data = await fetchBoardActivities(currentBoardId);
      setActivities(data);
    } catch (error) {
      console.error('Failed to load board activities:', error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && boardId) {
      void loadBoardActivities(boardId);
    } else {
      setActivities([]);
    }
  }, [boardId, isOpen]);

  if (!isOpen) return null;

  return (
    <ContentDialog
      onSubmit={() => {}}
      onClose={onClose}
      title={(
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="h-6 w-6 text-blue-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Board Activity
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close board activity"
            title="Close"
            className="cursor-pointer rounded-xl text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <svg className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
    >
      <div className="min-h-[300px]">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500 italic">
            Loading board activities...
          </div>
        ) : activities.length > 0 ? (
          <div className="flow-root">
            <ul className="-mb-8">
              {activities.map((activity, index) => {
                const isLast = index === activities.length - 1;
                let relativeTime = '';
                try {
                  relativeTime = formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true });
                } catch {
                  relativeTime = 'just now';
                }

                return (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {!isLast && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3 items-start">
                        <div>
                          <img
                            className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-4 ring-white object-cover"
                            src={activity.actor.avatar}
                            alt={activity.actor.name}
                          />
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-sm text-gray-600">
                            <span className="font-bold text-gray-900">{activity.actor.name}</span>{' '}
                            <span className="text-gray-500">{activity.details.description}</span>
                          </p>
                          {activity.task_title && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200 shadow-sm">
                                Task: {activity.task_title}
                              </span>
                              {activity.action === 'deleted' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                                  Deleted
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1.5">
                            {relativeTime}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center text-sm text-gray-400 italic">
            No activity logged for this board yet.
          </div>
        )}
      </div>
    </ContentDialog>
  );
}

export default BoardActivityDialog;
