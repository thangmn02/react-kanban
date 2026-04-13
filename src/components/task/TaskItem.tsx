import { Draggable } from 'react-beautiful-dnd'
import type { ITaskItem } from '../../types/task.type'

interface TaskItemProps {
  task: ITaskItem,
  index: number
  handleEditTask: any
}

function TaskItem({
  task,
  index,
  handleEditTask,
}: TaskItemProps) {
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
              <h3 className="text-base font-semibold text-gray-900 flex-1">
                {task.title}
              </h3>
              <button
                onClick={() => handleEditTask(task)}
                className="ml-2 text-gray-400 transition-opacity cursor-pointer"
                title="Edit task"
              >
                <svg className="w-[1.25rem] h-[1.25rem]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" d="M11.3 6.2H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h11c1.1 0 2-1 2-2.1V11l-4 4.2c-.3.3-.7.6-1.2.7l-2.7.6c-1.7.3-3.3-1.3-3-3.1l.6-2.9c.1-.5.4-1 .7-1.3l3-3.1Z" clip-rule="evenodd"></path>
                  <path fill-rule="evenodd" d="M19.8 4.3a2.1 2.1 0 0 0-1-1.1 2 2 0 0 0-2.2.4l-.6.6 2.9 3 .5-.6a2.1 2.1 0 0 0 .6-1.5c0-.2 0-.5-.2-.8Zm-2.4 4.4-2.8-3-4.8 5-.1.3-.7 3c0 .3.3.7.6.6l2.7-.6.3-.1 4.7-5Z" clip-rule="evenodd"></path>
                </svg>
              </button>
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
              {task.description}
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
              ) : task.daysLeft !== undefined && (
                <span className="text-xs text-gray-500">
                  {task.daysLeft} day{task.daysLeft !== 1 ? 's' : ''} left
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