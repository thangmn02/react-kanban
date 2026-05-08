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
  image?: string,
  daysLeft?: number,
  isDone?: boolean
} 