import type { BoardData, BoardListItem, BoardTaskItem } from '../types/task.type';
import type { ListRow, TaskInsert, TaskRow, TaskUpdate } from '../types/supabase.type';

interface BuildTaskInsertParams {
  boardId: string;
  listId: string;
  title: string;
  description: string;
  priority?: BoardTaskItem['priority'];
  startDate?: string;
  dueDate?: string;
  position: number;
  assignees?: BoardTaskItem['assignees'];
}

interface BuildTaskUpdateParams {
  title: string;
  description: string;
  priority?: BoardTaskItem['priority'];
  startDate?: string;
  dueDate?: string;
  assignees?: BoardTaskItem['assignees'];
}

export function createEmptyBoardData(): BoardData {
  return {
    columns: [],
    list: {},
    task: {},
  };
}

export function mapTaskRowToTaskItem(taskRow: TaskRow): BoardTaskItem {
  return {
    id: taskRow.id,
    title: taskRow.title,
    description: taskRow.description || '',
    assignees: Array.isArray(taskRow.assignees) ? taskRow.assignees as unknown as BoardTaskItem['assignees'] : [],
    priority: taskRow.priority || undefined,
    startDate: taskRow.start_date || undefined,
    dueDate: taskRow.due_date || undefined,
    category1: taskRow.category1 || undefined,
    category2: taskRow.category2 || undefined,
    image: taskRow.image || undefined,
    isDone: taskRow.is_done,
  };
}

export function buildBoardDataFromRows(listRows: ListRow[], taskRows: TaskRow[]): BoardData {
  const boardData = createEmptyBoardData();
  const sortedLists = [...listRows].sort((currentList, nextList) => currentList.position - nextList.position);

  sortedLists.forEach((listRow) => {
    const boardListItem: BoardListItem = {
      id: listRow.id,
      title: listRow.title,
      tasks: [],
    };

    boardData.columns.push(listRow.id);
    boardData.list[listRow.id] = boardListItem;
  });

  const sortedTasks = [...taskRows].sort((currentTask, nextTask) => currentTask.position - nextTask.position);

  sortedTasks.forEach((taskRow) => {
    boardData.task[taskRow.id] = mapTaskRowToTaskItem(taskRow);

    if (boardData.list[taskRow.list_id]) {
      boardData.list[taskRow.list_id].tasks.push(taskRow.id);
    }
  });

  return boardData;
}

export function buildTaskInsertPayload({
  boardId,
  listId,
  title,
  description,
  priority,
  startDate,
  dueDate,
  position,
  assignees,
}: BuildTaskInsertParams): TaskInsert {
  return {
    board_id: boardId,
    list_id: listId,
    title,
    description,
    priority: priority || 'Low',
    start_date: startDate || null,
    due_date: dueDate || null,
    assignees: (assignees || []) as any,
    category1: 'Design',
    category2: 'Sprint',
    is_done: false,
    position,
  };
}

export function buildTaskUpdatePayload({
  title,
  description,
  priority,
  startDate,
  dueDate,
  assignees,
}: BuildTaskUpdateParams): TaskUpdate {
  return {
    title,
    description,
    priority: priority || 'Low',
    start_date: startDate || null,
    due_date: dueDate || null,
    assignees: (assignees || []) as any,
  };
}
