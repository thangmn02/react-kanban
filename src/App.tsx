import { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import TaskList from './components/task/TaskList';

import { data } from './data';
import type { IBoardData, ITaskItem } from './types/task.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import TaskDialog from './components/organisms/dialog/TaskDialog';

export interface TaskDialogFormData {
  title: string;
  description: string;
  priority?: ITaskItem['priority'];
  dueDate?: string;
  startDate?: string;
}

function App() {
  const [boardData, setBoardData] = useState<IBoardData>(() => {
    const saved = localStorage.getItem('kanban_data');
    return saved ? JSON.parse(saved) : data;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'list' | 'card', listId: string, cardId?: string } | null>(null);
  const [editingTask, setEditingTask] = useState<ITaskItem | null>(null);

  useEffect(() => {
    localStorage.setItem('kanban_data', JSON.stringify(boardData));
  }, [boardData]);

  const onSubmitList = (formData: { title: string }) => {
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

  const onSubmitCard = (formData: TaskDialogFormData) => {
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
            priority: formData.priority || 'Low',
            startDate: formData.startDate || '',
            dueDate: formData.dueDate || '',
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
      }

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
    });

    setDeleteItem(null);
    toast.success(`${deleteItem.type === 'list' ? 'List' : 'Card'} deleted successfully!`, { theme: 'colored' });
  };

  const handleEditTask = (task: ITaskItem) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const onSubmitEditTask = (formData: TaskDialogFormData) => {
    if (!editingTask) return;

    setBoardData(prev => ({
      ...prev,
      task: {
        ...prev.task,
        [editingTask.id]: {
          ...prev.task[editingTask.id],
          title: formData.title,
          description: formData.description || '',
          priority: formData.priority || 'Low',
          startDate: formData.startDate || '',
          dueDate: formData.dueDate || '',
        }
      }
    }));

    setIsEditModalOpen(false);
    setEditingTask(null);
    toast.success('Task updated successfully!', { theme: 'colored' });
  };

  const toggleMenu = (listId: string | null) => {
    setOpenMenuId(openMenuId === listId ? null : listId);
  };

  const onDragEnd = (event: DropResult) => {
    const { source, destination, draggableId, type } = event;

    if (!destination) return;

    const { index: sourceIndex, droppableId: sourceDroppableId } = source;
    const { index: destinationIndex, droppableId: destinationDroppableId } = destination;

    if (type === 'LIST') {
      setBoardData(board => {
        const newColumns = [...board.columns];

        newColumns.splice(sourceIndex, 1);
        newColumns.splice(destinationIndex, 0, draggableId);

        return {
          ...board,
          columns: newColumns
        };
      });

      return;
    }

    if (sourceDroppableId === destinationDroppableId) {
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
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">HVAC Editor</h1>
            </div>
          </div>
        </div>
      </nav>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable
          droppableId="all-lists"
          direction="horizontal"
          type="LIST"
        >
          {(provided) => (
            <div className="p-4">
              <div
                className="flex items-start overflow-x-auto pb-4"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {boardData.columns.map((column, index) => {
                  const listItem = boardData.list[column];
                  const tasks = listItem.tasks.map(taskId => boardData.task[taskId]);

                  return (
                    <Draggable key={column} draggableId={column} index={index}>
                      {(draggableProvided) => (
                        <div
                          className="mr-4 w-80 flex-shrink-0"
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          {...draggableProvided.dragHandleProps}
                        >
                          <TaskList
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
                  );
                })}

                {provided.placeholder}

                <div className="w-80 flex-shrink-0">
                  <button
                    onClick={() => setIsGroupModalOpen(true)}
                    className="w-full cursor-pointer rounded-lg border border-dashed border-gray-200 bg-white py-8 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                  >
                    + Add another group
                  </button>
                </div>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <TaskDialog
        isOpen={isModalOpen || isEditModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsEditModalOpen(false);
          setActiveListId(null);
          setEditingTask(null);
        }}
        taskData={isEditModalOpen ? editingTask : null}
        onSubmitTask={isEditModalOpen ? onSubmitEditTask : onSubmitCard}
      />

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
