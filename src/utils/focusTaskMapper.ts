import type { FocusTask, FocusTaskInput } from '../types/focus.type';

export function mapTaskToFocusTask({
  task,
  boardId,
  boardTitle,
  listId,
  listTitle,
}: FocusTaskInput): FocusTask {
  return {
    id: task.id,
    boardId,
    boardTitle,
    listId,
    listTitle,
    title: task.title,
    priority: task.priority,
    dueDate: task.dueDate,
    assigneeAvatar: task.assignees[0]?.avatar,
    isDone: task.isDone,
  };
}
