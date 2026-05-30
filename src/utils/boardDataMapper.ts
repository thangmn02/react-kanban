import type { BoardData, BoardListItem, BoardTaskItem } from '../types/task.type';
import type {
  Json,
  ListRow,
  TaskChecklistItemInsert,
  TaskChecklistItemRow,
  TaskInsert,
  TaskLabelLinkRow,
  TaskLabelRow,
  TaskRow,
  TaskUpdate,
} from '../types/supabase.type';
import { normalizeTaskAssignees, normalizeTaskAttachments } from './taskCollections';

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
  attachments?: BoardTaskItem['attachments'];
  image?: string;
}

interface BuildTaskUpdateParams {
  title: string;
  description: string;
  priority?: BoardTaskItem['priority'];
  startDate?: string;
  dueDate?: string;
  assignees?: BoardTaskItem['assignees'];
  attachments?: BoardTaskItem['attachments'];
  image?: string;
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
    assignees: normalizeTaskAssignees(taskRow.assignees),
    priority: normalizeTaskPriority(taskRow.priority),
    startDate: taskRow.start_date || undefined,
    dueDate: taskRow.due_date || undefined,
    category1: taskRow.category1 || undefined,
    category2: taskRow.category2 || undefined,
    image: taskRow.image || undefined,
    isDone: taskRow.is_done,
    attachments: normalizeTaskAttachments(taskRow.attachments ?? null),
    labels: [],
    checklistItems: [],
  };
}

function serializeTaskAssignees(assignees: BoardTaskItem['assignees'] | undefined): Json {
  return (assignees || []).map((assignee) => ({
    name: assignee.name,
    avatar: assignee.avatar,
  }));
}

function normalizeTaskPriority(priority: string | null): BoardTaskItem['priority'] | undefined {
  if (
    priority === 'High'
    || priority === 'Medium'
    || priority === 'Low'
    || priority === 'Lowest'
  ) {
    return priority;
  }

  return undefined;
}

export function buildBoardDataFromRows(
  listRows: ListRow[],
  taskRows: TaskRow[],
  checklistItemRows: TaskChecklistItemRow[] = [],
  taskLabelRows: TaskLabelRow[] = [],
  taskLabelLinkRows: TaskLabelLinkRow[] = [],
): BoardData {
  const boardData = createEmptyBoardData();
  const sortedLists = [...listRows].sort((currentList, nextList) => currentList.position - nextList.position);
  const checklistItemsByTaskId = new Map<string, BoardTaskItem['checklistItems']>();
  const labelsById = new Map<string, BoardTaskItem['labels'][number]>();
  const labelsByTaskId = new Map<string, BoardTaskItem['labels']>();

  checklistItemRows
    .sort((currentChecklistItem, nextChecklistItem) => currentChecklistItem.position - nextChecklistItem.position)
    .forEach((checklistItemRow) => {
      const currentChecklistItems = checklistItemsByTaskId.get(checklistItemRow.task_id) || [];
      currentChecklistItems.push({
        id: checklistItemRow.id,
        text: checklistItemRow.content,
        isDone: checklistItemRow.is_done,
      });
      checklistItemsByTaskId.set(checklistItemRow.task_id, currentChecklistItems);
    });

  taskLabelRows.forEach((taskLabelRow) => {
    labelsById.set(taskLabelRow.id, {
      id: taskLabelRow.id,
      name: taskLabelRow.name,
      color: taskLabelRow.color as BoardTaskItem['labels'][number]['color'],
    });
  });

  taskLabelLinkRows.forEach((taskLabelLinkRow) => {
    const linkedLabel = labelsById.get(taskLabelLinkRow.label_id);

    if (!linkedLabel) {
      return;
    }

    const currentLabels = labelsByTaskId.get(taskLabelLinkRow.task_id) || [];
    currentLabels.push(linkedLabel);
    labelsByTaskId.set(taskLabelLinkRow.task_id, currentLabels);
  });

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
    boardData.task[taskRow.id] = {
      ...mapTaskRowToTaskItem(taskRow),
      labels: labelsByTaskId.get(taskRow.id) || [],
      checklistItems: checklistItemsByTaskId.get(taskRow.id) || [],
    };

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
  attachments,
  image,
}: BuildTaskInsertParams): TaskInsert {
  void attachments;

  return {
    board_id: boardId,
    list_id: listId,
    title,
    description,
    priority: priority || 'Low',
    start_date: startDate || null,
    due_date: dueDate || null,
    assignees: serializeTaskAssignees(assignees),
    category1: 'Design',
    category2: 'Sprint',
    image: image || null,
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
  attachments,
  image,
}: BuildTaskUpdateParams): TaskUpdate {
  void attachments;

  return {
    title,
    description,
    priority: priority || 'Low',
    start_date: startDate || null,
    due_date: dueDate || null,
    assignees: serializeTaskAssignees(assignees),
    image: image || null,
  };
}

export function buildTaskFieldUpdatePayload(
  fields: Partial<Pick<BoardTaskItem, 'priority' | 'assignees' | 'isDone'>>,
): TaskUpdate {
  const payload: TaskUpdate = {};

  if ('priority' in fields) {
    payload.priority = fields.priority ?? null;
  }

  if ('assignees' in fields) {
    payload.assignees = serializeTaskAssignees(fields.assignees);
  }

  if ('isDone' in fields) {
    payload.is_done = fields.isDone ?? false;
  }

  return payload;
}

export function buildChecklistItemInsertPayloads(
  taskId: string,
  checklistItems: BoardTaskItem['checklistItems'],
): TaskChecklistItemInsert[] {
  return checklistItems.map((checklistItem, position) => ({
    id: checklistItem.id,
    task_id: taskId,
    content: checklistItem.text,
    is_done: checklistItem.isDone,
    position,
  }));
}
