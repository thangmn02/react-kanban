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
import { DEFAULT_TASK_CATEGORIES, DEFAULT_TASK_PRIORITY, TASK_PRIORITIES } from '../constants';

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

interface ApplyTaskDefaultsParams {
  title: string;
  description: string;
  priority?: BoardTaskItem['priority'];
  startDate?: string;
  dueDate?: string;
  assignees?: BoardTaskItem['assignees'];
  image?: string;
}

type TaskDefaultsPayload = Pick<
  TaskInsert,
  'title' | 'description' | 'priority' | 'start_date' | 'due_date' | 'assignees' | 'image'
>;

function applyTaskDefaults({
  title,
  description,
  priority,
  startDate,
  dueDate,
  assignees,
  image,
}: ApplyTaskDefaultsParams): TaskDefaultsPayload {
  return {
    title,
    description,
    priority: priority || DEFAULT_TASK_PRIORITY,
    start_date: startDate || null,
    due_date: dueDate || null,
    assignees: serializeTaskAssignees(assignees),
    image: image || null,
  };
}

function normalizeTaskPriority(priority: string | null): BoardTaskItem['priority'] | undefined {
  if (priority !== null && (TASK_PRIORITIES as readonly string[]).includes(priority)) {
    return priority as BoardTaskItem['priority'];
  }

  return undefined;
}

function buildChecklistItemsMap(
  checklistItemRows: TaskChecklistItemRow[],
): Map<string, BoardTaskItem['checklistItems']> {
  const checklistItemsByTaskId = new Map<string, BoardTaskItem['checklistItems']>();

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

  return checklistItemsByTaskId;
}

function buildLabelsMap(taskLabelRows: TaskLabelRow[]): Map<string, BoardTaskItem['labels'][number]> {
  const labelsById = new Map<string, BoardTaskItem['labels'][number]>();

  taskLabelRows.forEach((taskLabelRow) => {
    labelsById.set(taskLabelRow.id, {
      id: taskLabelRow.id,
      name: taskLabelRow.name,
      color: taskLabelRow.color as BoardTaskItem['labels'][number]['color'],
    });
  });

  return labelsById;
}

function buildLabelTaskRelationships(
  taskLabelLinkRows: TaskLabelLinkRow[],
  labelsById: Map<string, BoardTaskItem['labels'][number]>,
): Map<string, BoardTaskItem['labels']> {
  const labelsByTaskId = new Map<string, BoardTaskItem['labels']>();

  taskLabelLinkRows.forEach((taskLabelLinkRow) => {
    const linkedLabel = labelsById.get(taskLabelLinkRow.label_id);

    if (!linkedLabel) {
      return;
    }

    const currentLabels = labelsByTaskId.get(taskLabelLinkRow.task_id) || [];
    currentLabels.push(linkedLabel);
    labelsByTaskId.set(taskLabelLinkRow.task_id, currentLabels);
  });

  return labelsByTaskId;
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
  const checklistItemsByTaskId = buildChecklistItemsMap(checklistItemRows);
  const labelsById = buildLabelsMap(taskLabelRows);
  const labelsByTaskId = buildLabelTaskRelationships(taskLabelLinkRows, labelsById);

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
  image,
}: BuildTaskInsertParams): TaskInsert {
  return {
    ...applyTaskDefaults({ title, description, priority, startDate, dueDate, assignees, image }),
    board_id: boardId,
    list_id: listId,
    category1: DEFAULT_TASK_CATEGORIES.CATEGORY_1,
    category2: DEFAULT_TASK_CATEGORIES.CATEGORY_2,
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
  image,
}: BuildTaskUpdateParams): TaskUpdate {
  return applyTaskDefaults({ title, description, priority, startDate, dueDate, assignees, image });
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
