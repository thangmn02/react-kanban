export interface BoardData {
  columns: string[],
  list: BoardListMap,
  task: BoardTaskMap
}

export interface BoardListMap {
  [key: string]: BoardListItem
}

export interface BoardListItem {
  id: string,
  title: string,
  tasks: string[]
} 

export interface BoardTaskMap {
  [key: string]: BoardTaskItem
}

export interface TaskAssignee {
  name: string,
  avatar: string
}

export interface BoardTaskItem {
  id: string,
  title: string,
  description: string,
  assignees: TaskAssignee[],
  priority?: 'High' | 'Medium' | 'Low' | 'Lowest',
  startDate?: string,
  dueDate?: string,
  category1?: string,
  category2?: string,
  image?: string,
  isDone?: boolean
} 

export interface BoardDeleteItem {
  type: 'list' | 'card',
  listId: string,
  cardId?: string
}

export interface ITaskActivity {
  id: string;
  task_id: string;
  task_title?: string;
  action: 'create' | 'update' | 'move' | 'priority_change' | 'assignee_change' | 'status_change' | 'deleted';
  details: {
    description: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
  };
  actor: {
    name: string;
    avatar: string;
  };
  created_at: string;
}

export type IBoardData = BoardData;
export type IList = BoardListMap;
export type IListItem = BoardListItem;
export type ITask = BoardTaskMap;
export type IAssignItem = TaskAssignee;
export type ITaskItem = BoardTaskItem;
