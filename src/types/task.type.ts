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
  avatar: string,
  /** Stable user identity (Supabase auth uid). Absent for legacy/seed data. */
  userId?: string,
  /** Workspace membership id for normalized assignment tracking. */
  workspaceMemberId?: string
}

export type TaskLabelColor = 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface TaskLabel {
  id: string,
  name: string,
  color: TaskLabelColor
}

export interface TaskAttachment {
  id: string,
  name: string,
  url: string,
  type: 'link'
}

export interface TaskChecklistItem {
  id: string,
  text: string,
  isDone: boolean
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
  isDone?: boolean,
  updatedAt?: string,
  labels: TaskLabel[],
  attachments: TaskAttachment[],
  checklistItems: TaskChecklistItem[]
} 

export interface TaskDialogFormData {
  title: string;
  description: string;
  priority?: BoardTaskItem['priority'];
  dueDate?: string;
  startDate?: string;
  assignees?: BoardTaskItem['assignees'];
  labels: BoardTaskItem['labels'];
  attachments: BoardTaskItem['attachments'];
  checklistItems: BoardTaskItem['checklistItems'];
  image?: string;
}

export type QuickPlanAssignmentMode = 'per-line' | 'per-assignee';

export interface QuickPlanFormData {
  targetListId: string;
  titles: string[];
  dueDate?: string;
  priority?: BoardTaskItem['priority'];
  assignees: BoardTaskItem['assignees'];
  sharedResource?: string;
  assignmentMode: QuickPlanAssignmentMode;
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
    oldValue?: unknown;
    newValue?: unknown;
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
