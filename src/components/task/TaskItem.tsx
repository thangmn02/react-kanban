import { Draggable } from 'react-beautiful-dnd'
import type { ITaskItem } from '../../types/task.type'
import { getDueDateMeta, getPriorityBadgeClass } from '../../utils/taskMetadata'

interface TaskItemProps {
  task: ITaskItem,
  index: number
  handleEditTask: any
  listId: string
  setDeleteItem: any
}

function TaskItem({
  task,
  index,
  handleEditTask,
  listId,
  setDeleteItem
}: TaskItemProps) {
  const dueDateMeta = getDueDateMeta(task.dueDate)
  const priorityBadgeClass = getPriorityBadgeClass(task.priority)
  const descriptionPreview = (() => {
    if (typeof window === 'undefined') {
      return task.description.replace(/<[^>]*>/g, ' ').trim()
    }

    const descriptionDocument = new DOMParser().parseFromString(task.description, 'text/html')
    return descriptionDocument.body.textContent?.trim() || ''
  })()

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            {/* Task Title */}
            <div className="flex items-start justify-between mb-2 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="text-base font-semibold text-gray-900 flex-1 min-w-0 break-all">
                    {task.title}
                  </h3>
                  {task.priority && priorityBadgeClass && (
                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClass}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center shrink-0">
                <button
                  onClick={() => handleEditTask(task)}
                  className="ml-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  title="Edit task"
                >
                  <svg className="w-[1.25rem] h-[1.25rem]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M11.3 6.2H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11c1.1 0 2-1 2-2.1V11l-4 4.2c-.3.3-.7.6-1.2.7l-2.7.6c-1.7.3-3.3-1.3-3-3.1l.6-2.9c.1-.5.4-1 .7-1.3l3-3.1Z" clipRule="evenodd"></path>
                    <path fillRule="evenodd" d="M19.8 4.3a2.1 2.1 0 0 0-1-1.1 2 2 0 0 0-2.2.4l-.6.6 2.9 3 .5-.6a2.1 2.1 0 0 0 .6-1.5c0-.2 0-.5-.2-.8Zm-2.4 4.4-2.8-3-4.8 5-.1.3-.7 3c0 .3.3.7.6.6l2.7-.6.3-.1 4.7-5Z" clipRule="evenodd"></path>
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteItem({ type: 'card', listId, cardId: task.id });
                  }}
                  className="ml-2 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                  title="Delete task"
                >
                  <svg className="w-[1.25rem] h-[1.25rem]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Task Image */}
            {task.image && (
              <img
                src={task.image}
                alt={task.title}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
            )}

            {/* Task Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {descriptionPreview}
            </p>

            {/* Task Footer */}
            <div className="flex items-center justify-between">
              {/* Assignees */}
              <div className="flex -space-x-2">
                {task.assignees.map((assignee, index) => (
                  <img
                    key={index}
                    src={assignee.avatar}
                    alt={assignee.name}
                    className="w-8 h-8 rounded-full border-2 border-white"
                    title={assignee.name}
                  />
                ))}
              </div>

              {/* Days Left / Status */}
              {task.isDone ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Done
                </span>
              ) : dueDateMeta && (
                <span className={`inline-flex items-center gap-1 text-xs ${dueDateMeta.className}`}>
                  <svg className="h-3.5 w-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0Z" />
                  </svg>
                  {dueDateMeta.label}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>

  )
}

export default TaskItem
