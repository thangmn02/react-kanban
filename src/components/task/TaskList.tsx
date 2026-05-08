import type { IListItem, ITaskItem } from '../../types/task.type';
import Typography from '../ui/Typography';
import TaskItem from './TaskItem';
import { Droppable } from 'react-beautiful-dnd';

interface TaskListProps {
  index: number,
  listItem: IListItem,
  tasks: ITaskItem[],
  toggleMenu: (listId: string | null) => void,
  handleEditTask: (task: ITaskItem) => void,
  openMenuId: any,
  setIsModalOpen: any,
  setDeleteItem: any
}

function TaskList({
  index,
  listItem,
  tasks,
  toggleMenu,
  handleEditTask,
  openMenuId,
  setIsModalOpen,
  setDeleteItem
}: TaskListProps) {

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Typography
            className="text-sm font-semibold text-gray-700 uppercase"
            content={listItem.title}
            component="h2"
          />
          <Typography
            className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"
            content={listItem.tasks.length.toString()}
            component="span"
          />
        </div>

        {/* Three-dot Menu */}
        <div className="relative">
          <button
            onClick={() => toggleMenu(listItem.id)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {openMenuId === listItem.id && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => toggleMenu(null)}
              ></div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
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
      </div>

      {/* Tasks */}
      <Droppable
        droppableId={listItem.id.toString()}
        direction='vertical'
        type="CARD"
      >
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{ minHeight: 10 }}
          >
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <TaskItem
                  key={task.id}
                  index={index}
                  task={task}
                  listId={listItem.id}
                  handleEditTask={handleEditTask}
                  setDeleteItem={setDeleteItem}
                />
              ))}


            </div>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <br />

      {/* Add New Task Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 border-dashed rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        + Add new task
      </button>
    </>
  )
}

export default TaskList