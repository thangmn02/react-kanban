export interface IBoardData {
  columns: string[],
  list: IList,
  task: ITask
}

export interface IList {
  [key: string]: IListItem
}

export interface IListItem {
  id: string,
  title: string,
  tasks: string[]
} 

export interface ITask {
  [key: string]: ITaskItem
}

export interface IAssignItem {
  name: string,
  avatar: string
}

export interface ITaskItem {
  id: string,
  title: string,
  description: string,
  assignees: IAssignItem[],
  priority?: 'High' | 'Medium' | 'Low' | 'Lowest',
  startDate?: string,
  dueDate?: string,
  category1?: string,
  category2?: string,
  image?: string,
  isDone?: boolean
} 
