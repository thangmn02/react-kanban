import { useState, useEffect } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Button from './components/atoms/Button';
import ButtonIcon from './components/atoms/ButtonIcon';
import TaskList from './components/task/TaskList';

import { data } from './data';
import type { ITaskItem, IBoardData } from './types/task.type';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';

interface Task {
  id: number;
  title: string;
  description: string;
  assignees: { name: string; avatar: string }[];
  daysLeft?: number;
  image?: string;
  isDone?: boolean;
}

const cardSchema = yup.object({
  title: yup.string().required('Title is required'),
  description: yup.string()
}).required();

function App() {
  const [boardData, setBoardData] = useState<IBoardData>(() => {
    const saved = localStorage.getItem('kanban_data');
    return saved ? JSON.parse(saved) : data;
  });

  useEffect(() => {
    localStorage.setItem('kanban_data', JSON.stringify(boardData));
  }, [boardData]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'list' | 'card', listId: string, cardId?: string } | null>(null);
  const [editingTask, setEditingTask] = useState<ITaskItem | null>(null);

  const { register: registerCard, handleSubmit: handleSubmitCard, formState: { errors: errorsCard }, reset: resetCard } = useForm({
    resolver: yupResolver(cardSchema)
  });

  const onSubmitList = (formData: any) => {
    const newListId = `list-${Date.now()}`;
    setBoardData(prev => ({
      ...prev,
      columns: [...prev.columns, newListId],
      list: {
        ...prev.list,
        [newListId]: {
          id: newListId,
          title: formData.title,
          tasks: []
        }
      }
    }));
    setIsGroupModalOpen(false);
    toast.success('List added successfully!', { theme: 'colored' });
  };

  const onSubmitCard = (formData: any) => {
    if (!activeListId) return;
    const newTaskId = `task-${Date.now()}`;
    setBoardData(prev => {
      const targetList = prev.list[activeListId];
      return {
        ...prev,
        task: {
          ...prev.task,
          [newTaskId]: {
            id: newTaskId,
            title: formData.title,
            description: formData.description || '',
            assignees: [],
            priority: 'low',
            startDate: '',
            dueDate: '',
            category1: 'Design',
            category2: 'Sprint'
          }
        },
        list: {
          ...prev.list,
          [activeListId]: {
            ...targetList,
            tasks: [...targetList.tasks, newTaskId]
          }
        }
      };
    });
    setIsModalOpen(false);
    setActiveListId(null);
    resetCard();
    toast.success('Card added successfully!', { theme: 'colored' });
  };

  const handleDeleteConfirm = () => {
    if (!deleteItem) return;

    setBoardData(prev => {
      if (deleteItem.type === 'list') {
        const newColumns = prev.columns.filter(col => col !== deleteItem.listId);
        const newList = { ...prev.list };
        delete newList[deleteItem.listId];
        return {
          ...prev,
          columns: newColumns,
          list: newList
        };
      } else {
        const targetList = prev.list[deleteItem.listId];
        const newTasks = targetList.tasks.filter(id => id !== deleteItem.cardId);
        const newTaskDict = { ...prev.task };
        if (deleteItem.cardId) {
          delete newTaskDict[deleteItem.cardId];
        }

        return {
          ...prev,
          task: newTaskDict,
          list: {
            ...prev.list,
            [deleteItem.listId]: {
              ...targetList,
              tasks: newTasks
            }
          }
        };
      }
    });

    setDeleteItem(null);
    toast.success(`${deleteItem.type === 'list' ? 'List' : 'Card'} deleted successfully!`, { theme: 'colored' });
  };

  const handleEditTask = (task: ITaskItem) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  function toggleMenu(listId: string | null) {
    console.log('toggleMenu: ', listId)
    setOpenMenuId(openMenuId === listId ? null : listId)
  }



  const onDragEnd = (event: DropResult) => {
    console.log('onDragEnd: ', event)


    const { source, destination, draggableId, type } = event;

    if (!destination) return;

    const { index: sourceIndex, droppableId: sourceDroppableId } = source;
    const { index: destinationIndex, droppableId: destinationDroppableId } = destination;

    if (type === 'LIST') {
      // TODO: drag drop list
      setBoardData(boardData => {
        const newColumns = [...boardData.columns];
        newColumns.splice(sourceIndex, 1); // delete item
        newColumns.splice(destinationIndex, 0, draggableId); // add item
        return {
          ...boardData,
          columns: newColumns
        }
      })

      return;
    }

    if (sourceDroppableId === destinationDroppableId) {
      // drag drop card same list
      setBoardData(prev => {
        const sourceList = prev.list[sourceDroppableId];
        const newTasks = [...sourceList.tasks];

        newTasks.splice(sourceIndex, 1);
        newTasks.splice(destinationIndex, 0, draggableId);

        return {
          ...prev,
          list: {
            ...prev.list,
            [sourceDroppableId]: {
              ...sourceList,
              tasks: newTasks
            }
          }
        };
      });
      return;
    }

    // drag drop card difference list
    setBoardData(prev => {
      const sourceList = prev.list[sourceDroppableId];
      const destList = prev.list[destinationDroppableId];

      const newSourceTasks = [...sourceList.tasks];
      const newDestTasks = [...destList.tasks];

      newSourceTasks.splice(sourceIndex, 1);
      newDestTasks.splice(destinationIndex, 0, draggableId);

      return {
        ...prev,
        list: {
          ...prev.list,
          [sourceDroppableId]: {
            ...sourceList,
            tasks: newSourceTasks
          },
          [destinationDroppableId]: {
            ...destList,
            tasks: newDestTasks
          }
        }
      };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">HVAC Editor</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Kanban Board */}
      <DragDropContext
        onDragEnd={onDragEnd}
      >
        <Droppable
          droppableId='all-lists'
          direction='horizontal'
          type="LIST"
        >
          {(provided) => (
            <div className="p-4">
              <div
                className="flex overflow-x-auto pb-4 items-start"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {boardData.columns.map((column, index) => {
                  const listItem = boardData.list[column];
                  const tasks = listItem.tasks.map(taskId => boardData.task[taskId]);

                  return (
                    <Draggable key={column} draggableId={column} index={index}>
                      {(provided) => (
                        <div
                          className="flex-shrink-0 w-80 mr-4"
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TaskList
                            index={index}
                            listItem={listItem}
                            tasks={tasks}
                            toggleMenu={toggleMenu}
                            openMenuId={openMenuId}
                            handleEditTask={handleEditTask}
                            setDeleteItem={setDeleteItem}
                            setIsModalOpen={() => {
                              setActiveListId(listItem.id);
                              setIsModalOpen(true);
                            }}
                          />
                        </div>
                      )}
                    </Draggable>
                  )
                })}

                {provided.placeholder}

                <div className="flex-shrink-0 w-80">
                  <button
                    onClick={() => setIsGroupModalOpen(true)}
                    className="w-full py-8 text-sm font-medium text-gray-500 bg-white border border-gray-200 border-dashed rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    + Add another group
                  </button>
                </div>
              </div>
            </div>
          )}
        </Droppable>

      </DragDropContext>


      {/* Edit Task Modal */}
      {isEditModalOpen && editingTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900 opacity-50 transition-opacity"
            onClick={() => setIsEditModalOpen(false)}
          ></div>

          {/* Modal */}
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit task</h3>
                <div className="flex items-center space-x-2">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="flex flex-col space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editingTask.title}
                      onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingTask.description}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                      className="flex-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>


                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Assignee & Communication */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignee & Communication
                    </label>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="flex -space-x-2">
                        {editingTask.assignees.map((assignee, index) => (
                          <img
                            key={index}
                            src={assignee.avatar}
                            alt={assignee.name}
                            className="w-8 h-8 rounded-full border-2 border-white"
                          />
                        ))}
                      </div>
                      <button className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add member
                      </button>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['High', 'Medium', 'Low', 'Lowest'].map((priority) => (
                        <label key={priority} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={priority === 'Low'}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start date
                      </label>
                      <input
                        type="text"
                        placeholder="Start date"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due date
                      </label>
                      <input
                        type="text"
                        placeholder="End date"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Design</option>
                        <option>Development</option>
                        <option>Testing</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type
                      </label>
                      <select className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Sprint</option>
                        <option>Backlog</option>
                        <option>Epic</option>
                      </select>
                    </div>
                  </div>

                  {/* Deadline notification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline notification
                    </label>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Notification</option>
                        <option>Email</option>
                        <option>SMS</option>
                      </select>
                      <input
                        type="number"
                        defaultValue="1"
                        className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select className="w-28 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Days</option>
                        <option>Hours</option>
                        <option>Weeks</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Section */}
              <div className="">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Activity</h4>

                {/* Add Comment */}
                <div className="mb-4">
                  <div className="flex items-start space-x-2">
                    <img
                      src="https://flowbite.com/application-ui/demo/images/users/bonnie-green.png"
                      alt="User"
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Add a comment</span>
                        <span className="float-right text-xs">Premm M to comment</span>
                      </div>
                      <div className="border border-gray-300 rounded-lg">
                        <div className="flex items-center space-x-2 px-2 py-1 border-b border-gray-200">
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </button>
                          <button className="ml-auto p-1 text-gray-500 hover:text-gray-700 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </button>
                        </div>
                        <textarea
                          placeholder="Write a description here"
                          rows={3}
                          className="w-full px-3 py-2 bg-white text-gray-900 placeholder-gray-400 focus:outline-none resize-none rounded-b-lg"
                        ></textarea>
                      </div>
                      <button className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Post comment
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing Comments */}
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <img
                      src="https://flowbite.com/application-ui/demo/images/users/roberta-casas.png"
                      alt="Roberta Casas"
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">Roberta Casas</span>
                        <span className="text-xs text-gray-500">Mar 15, 2025</span>
                        <span className="text-xs text-gray-400">Edited on Aug 18</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        Any frictions in the user journey hinder customers from reaching their goals. Before starting redesign, it's crucial to detect the obstacles users face when interacting with your website.
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <button className="hover:text-gray-700">Edit</button>
                        <button className="hover:text-gray-700">Reply</button>
                      </div>
                    </div>
                    <ButtonIcon
                      icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-start space-x-3 mt-6 pt-6 border-t border-gray-200">
                <Button
                  text="Add new task"
                  variant='primary'
                  icon={
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                />

                <Button
                  text="Cancel"
                  variant='outline'
                />

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900 opacity-50 transition-opacity"
            onClick={() => setIsModalOpen(false)}
          ></div>

          {/* Modal */}
          <div className="flex min-h-screen items-center justify-center p-4">
            <form onSubmit={handleSubmitCard(onSubmitCard)} className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add new task</h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="flex flex-col space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      placeholder="Add title here"
                      {...registerCard('title')}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errorsCard.title && <span className="text-red-500 text-sm">{errorsCard.title.message as string}</span>}
                  </div>

                  {/* Description */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    {/* Toolbar */}
                    <div className="flex items-center space-x-2 mb-2 px-2 py-1 bg-gray-50 rounded-t-lg border border-gray-300 border-b-0">
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </button>
                      <button type="button" className="ml-auto p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                    </div>
                    <textarea
                      placeholder="Write a description here"
                      {...registerCard('description')}
                      className="flex-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-b-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Assignee & Communication */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignee & Communication
                    </label>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="flex -space-x-2">
                        <img
                          src="https://flowbite.com/application-ui/demo/images/users/bonnie-green.png"
                          alt="User"
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                        <img
                          src="https://flowbite.com/application-ui/demo/images/users/roberta-casas.png"
                          alt="User"
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-700">
                          +9
                        </div>
                      </div>
                      <button type="button" className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add member
                      </button>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['High', 'Medium', 'Low', 'Lowest'].map((priority) => (
                        <label key={priority} className="flex items-center">
                          <input
                            type="checkbox"
                            defaultChecked={priority === 'Low'}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start date
                      </label>
                      <div className="relative">
                        <input
                          type="date"

                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due date
                      </label>
                      <div className="relative">
                        <input
                          type="date"

                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                        <svg className="inline w-4 h-4 ml-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </label>
                      <select

                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>Design</option>
                        <option>Development</option>
                        <option>Testing</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                        <svg className="inline w-4 h-4 ml-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </label>
                      <select

                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>Sprint</option>
                        <option>Backlog</option>
                        <option>Epic</option>
                      </select>
                    </div>
                  </div>

                  {/* Deadline notification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline notification
                    </label>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Notification</option>
                        <option>Email</option>
                        <option>SMS</option>
                      </select>
                      <input
                        type="number"
                        defaultValue="1"
                        className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select className="w-28 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Days</option>
                        <option>Hours</option>
                        <option>Weeks</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-start space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button type="submit" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add new task
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteItem && (
        <DeleteDialog 
          onSubmit={handleDeleteConfirm}
          onClose={() => setDeleteItem(null)}
        >
          Are you sure you want to delete this {deleteItem.type}?
        </DeleteDialog>
      )}
      
      {isGroupModalOpen && (
        <AddGroupDialog 
          onClose={() => setIsGroupModalOpen(false)}
          onSubmitGroup={onSubmitList}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default App;
