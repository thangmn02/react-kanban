/**
 * LocalBoardStore — a persistent, localStorage-backed board repository for
 * local demo mode.
 *
 * **Problem (P0-1):** Previously, mock-mode write services returned ephemeral
 * temp objects while `fetchBoardSnapshot` always returned the static seed
 * `BoardData`. After any mutation the UI called `refreshBoardData()`, which
 * re-fetched the seed and discarded the write.
 *
 * **Solution:** This store is the single source of truth for all mock-mode
 * board data. On first access it seeds itself from the original demo data
 * (converted to normalized row shape). Every subsequent read/write goes
 * through the store so mutations survive page refreshes.
 *
 * Data is scoped under `kanban:mock-user:local-mock-workspace:board_store:v1`
 * via the typed storage adapter, so it is isolated from any real Supabase
 * user's cached data (P0-3).
 */

import { data as seedBoardData } from '../../data';
import { findBoardTemplateById } from '../../data/boardTemplates';
import {
  DEFAULT_BOARD_TITLE,
  DEFAULT_TASK_CATEGORIES,
  DEFAULT_TASK_PRIORITY,
  ERROR_MESSAGES,
  LIST_POSITION_STEP,
} from '../../constants';
import { createLocalId } from '../../utils/idGenerator';
import type { BoardTaskItem, TaskAssignee } from '../../types/task.type';
import type { Json } from '../../types/supabase.type';
import type {
  BoardInsert,
  BoardRow,
  ListInsert,
  ListRow,
  TaskActivityInsert,
  TaskActivityRow,
  BriefingPinInsert,
  BriefingPinRow,
  TaskChecklistItemRow,
  TaskInsert,
  TaskLabelLinkRow,
  TaskLabelRow,
  TaskRow,
  TaskUpdate,
} from '../../types/supabase.type';
import {
  buildStorageKey,
  type StorageScope,
} from '../../shared/storage/storageAdapter';
import { planTaskWorkflow, type WorkflowRequest, type WorkflowResult } from '../../features/task/model/task-workflow';
import { addDays, addMonths, format, parseISO } from 'date-fns';

export interface LocalBoardState {
  boards: BoardRow[];
  lists: ListRow[];
  tasks: TaskRow[];
  checklistItems: TaskChecklistItemRow[];
  labels: TaskLabelRow[];
  labelLinks: TaskLabelLinkRow[];
  activities: TaskActivityRow[];
  briefingPins: BriefingPinRow[];
}

export interface LocalBoardSnapshot {
  boardId: string | null;
  listRows: ListRow[];
  taskRows: TaskRow[];
  checklistItemRows: TaskChecklistItemRow[];
  labelRows: TaskLabelRow[];
  labelLinkRows: TaskLabelLinkRow[];
}

const BOARD_STORE_FEATURE = 'board_store';
const MOCK_SCOPE: StorageScope = { userId: 'mock-user', workspaceId: 'local-mock-workspace' };
export const LOCAL_MOCK_WORKSPACE_ID = 'local-mock-workspace';
const LOCAL_MOCK_BOARD_ID = 'local-mock-board';

function nowIso(): string {
  return new Date().toISOString();
}

function serializeAssignees(assignees: TaskAssignee[] | undefined): Json {
  return (assignees ?? []).map((assignee) => ({
    name: assignee.name,
    avatar: assignee.avatar,
    ...(assignee.userId ? { userId: assignee.userId } : {}),
    ...(assignee.workspaceMemberId ? { workspaceMemberId: assignee.workspaceMemberId } : {}),
  }));
}


function seedState(): LocalBoardState {
  const now = nowIso();
  const boardRow: BoardRow = {
    id: LOCAL_MOCK_BOARD_ID,
    workspace_id: LOCAL_MOCK_WORKSPACE_ID,
    title: DEFAULT_BOARD_TITLE,
    description: 'Local demo board',
    created_by: null,
    created_at: now,
    updated_at: null,
    archived_at: null,
  };

  const lists: ListRow[] = [];
  const tasks: TaskRow[] = [];
  const checklistItems: TaskChecklistItemRow[] = [];
  const labels: TaskLabelRow[] = [];
  const labelLinks: TaskLabelLinkRow[] = [];

  seedBoardData.columns.forEach((listId, listIndex) => {
    const listItem = seedBoardData.list[listId];
    if (!listItem) return;

    lists.push({
      id: listItem.id,
      workspace_id: LOCAL_MOCK_WORKSPACE_ID,
      board_id: LOCAL_MOCK_BOARD_ID,
      title: listItem.title,
      position: listIndex * LIST_POSITION_STEP,
      created_at: now,
      updated_at: null,
      archived_at: null,
    });

    listItem.tasks.forEach((taskId, taskIndex) => {
      const task = seedBoardData.task[taskId];
      if (!task) return;

      tasks.push({
        id: task.id,
        board_id: LOCAL_MOCK_BOARD_ID,
        list_id: listItem.id,
        workspace_id: LOCAL_MOCK_WORKSPACE_ID,
        title: task.title,
        description: task.description ?? null,
        assignees: serializeAssignees(task.assignees),
        priority: task.priority ?? null,
        start_date: task.startDate ?? null,
        due_date: task.dueDate ?? null,
        category1: DEFAULT_TASK_CATEGORIES.CATEGORY_1,
        category2: DEFAULT_TASK_CATEGORIES.CATEGORY_2,
        image: task.image ?? null,
        is_done: task.isDone ?? false,
        repeat_interval: task.repeatInterval ?? null,
        position: taskIndex * LIST_POSITION_STEP,
        created_by: null,
        deleted_at: null,
        archived_at: null,
        completed_at: task.isDone ? now : null,
        updated_at: now,
        created_at: now,
      });

      task.checklistItems.forEach((item, idx) => {
        checklistItems.push({
          id: item.id, task_id: task.id, content: item.text,
          is_done: item.isDone, position: idx,
          workspace_id: LOCAL_MOCK_WORKSPACE_ID,
          created_at: now, updated_at: null,
        });
      });

      task.labels.forEach((label) => {
        if (!labels.some((l) => l.id === label.id)) {
          labels.push({
            id: label.id, board_id: LOCAL_MOCK_BOARD_ID,
            workspace_id: LOCAL_MOCK_WORKSPACE_ID,
            name: label.name, color: label.color,
            created_at: now, updated_at: null,
          });
        }
        labelLinks.push({
          task_id: task.id, label_id: label.id,
          workspace_id: LOCAL_MOCK_WORKSPACE_ID, created_at: now,
        });
      });
    });
  });

  return { boards: [boardRow], lists, tasks, checklistItems, labels, labelLinks, activities: [], briefingPins: [] };
}

let cachedState: LocalBoardState | null = null;

function getState(): LocalBoardState {
  const raw = localStorage.getItem(buildStorageKey(MOCK_SCOPE, BOARD_STORE_FEATURE));
  let stored: LocalBoardState | null;
  try { stored = raw === null ? null : JSON.parse(raw); } catch { throw new Error('Local data could not be read. Restore the local backup before continuing.'); }
  if (stored && Array.isArray(stored.boards) && Array.isArray(stored.lists) && Array.isArray(stored.tasks)) {
    cachedState = { ...stored, activities: Array.isArray(stored.activities) ? stored.activities : [], briefingPins: Array.isArray(stored.briefingPins) ? stored.briefingPins : [] };
  } else if (stored === null) {
    cachedState = seedState();
    saveState();
  } else throw new Error('Local data has an unsupported format. Existing data was preserved.');
  return cachedState;
}

/** One recoverable storage commit owns state, membership, activity and recurrence. */
export function localTransitionTaskWorkflow(request: WorkflowRequest): WorkflowResult {
  const current = getState();
  if(!current.boards.some(board=>board.id===request.boardId&&board.workspace_id===request.workspaceId&&!board.archived_at))throw new Error('Board is unavailable in this workspace.');
  const task = current.tasks.find(t => t.id === request.taskId);
  if (!task) throw new Error('Task was not found.');
  const lists = current.lists.filter(l=>l.board_id===request.boardId && l.workspace_id===request.workspaceId && !l.archived_at);
  const duplicate = current.activities.some(a=>a.id===request.operationId && a.task_id===task.id);
  const now = nowIso();
  const plan = planTaskWorkflow(task, lists, current.tasks, current.activities, duplicate?{...request,expectedListId:undefined,expectedUpdatedAt:undefined}:request, now);
  if (duplicate || !plan.changed) return {task,changed:false,completedTransition:false,mapping:plan.policy.mode,occurrence:null};
  const next = structuredClone(current);
  const updated = next.tasks.find(t=>t.id===task.id)!;
  Object.assign(updated,{is_done:plan.isDone,completed_at:plan.completedAt,list_id:plan.listId,updated_at:now});
  for(const listId of new Set([task.list_id,plan.listId])) {
    const ordered = next.tasks.filter(t=>t.list_id===listId && t.id!==task.id && !t.deleted_at&&!t.archived_at)
      .sort((a,b)=>a.position-b.position||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
    if(listId===plan.listId) ordered.splice(plan.targetIndex,0,updated);
    ordered.forEach((row,index)=>{ row.position=index*LIST_POSITION_STEP; });
  }
  const completedTransition = !task.is_done && updated.is_done;
  const previousRecurrence = current.activities.some(a=>a.task_id===task.id && Boolean((a.details as Record<string,unknown>).recurrenceId));
  let occurrence: TaskRow|null = null;
  if(completedTransition && !previousRecurrence && task.due_date && ['daily','weekly','monthly'].includes(task.repeat_interval||'')) {
    const date=parseISO(task.due_date);
    const due=format(task.repeat_interval==='monthly'?addMonths(date,1):addDays(date,task.repeat_interval==='weekly'?7:1),'yyyy-MM-dd');
    const activeList=plan.policy.activeListId||task.list_id;
    occurrence={...task,id:createLocalId('task'),list_id:activeList,position:Math.max(-LIST_POSITION_STEP,...next.tasks.filter(t=>t.list_id===activeList&&!t.deleted_at&&!t.archived_at).map(t=>t.position))+LIST_POSITION_STEP,
      due_date:due,is_done:false,completed_at:null,created_at:now,updated_at:now};
    next.tasks.push(occurrence);
  }
  next.activities.push({id:request.operationId,task_id:task.id,task_title:task.title,board_id:task.board_id,workspace_id:task.workspace_id,
    actor_id:null,actor:{name:'You',avatar:''},action:task.is_done!==updated.is_done?'status_change':'move',created_at:now,
    details:{description:request.kind==='move'?'Moved task through workflow':updated.is_done?'Marked task as completed':'Reopened task',workflowTransition:true,
      fromListId:task.list_id,fromIndex:plan.sourceIndex,fromPosition:task.position,toListId:updated.list_id,toPosition:updated.position,
      fromCompleted:task.is_done,toCompleted:updated.is_done,...(occurrence?{recurrenceId:occurrence.id}:{})}});
  // Do not use the general adapter's best-effort writes for a domain commit.
  localStorage.setItem(buildStorageKey(MOCK_SCOPE,'workflow_backup'),JSON.stringify(current));
  localStorage.setItem(buildStorageKey(MOCK_SCOPE,BOARD_STORE_FEATURE),JSON.stringify(next));
  cachedState=next;
  return {task:updated,changed:true,completedTransition,mapping:plan.policy.mode,occurrence};
}

function saveState(): void {
  if (!cachedState) return;
  const key = buildStorageKey(MOCK_SCOPE,BOARD_STORE_FEATURE);
  const previous = localStorage.getItem(key);
  try {
    if (previous !== null) localStorage.setItem(buildStorageKey(MOCK_SCOPE,'board_store_backup'),previous);
    localStorage.setItem(key,JSON.stringify(cachedState));
  } catch {
    cachedState = previous ? JSON.parse(previous) : null;
    throw new Error('Local changes could not be saved. Existing data was preserved. Free storage space and try again.');
  }
}

export function resetLocalBoardStore(): void {
  cachedState = seedState();
  saveState();
}

export function localFetchBoards(workspaceId?: string | null): BoardRow[] {
  const state = getState();
  return state.boards.filter((b) => (
    b.archived_at === null && (workspaceId == null || b.workspace_id === workspaceId)
  ));
}

/**
 * All non-deleted, non-archived tasks for a workspace. Used by the Home and
 * Today local services, which previously read the static seed data instead of
 * the (mutable) local store — so local mutations never reached those pages.
 */
export function localFetchAllTasks(workspaceId?: string | null): TaskRow[] {
  const state = getState();
  return state.tasks.filter((t) => (
    t.deleted_at === null && t.archived_at === null
    && (workspaceId == null || t.workspace_id === workspaceId)
  ));
}

/** All non-archived lists for a workspace (across every board). */
export function localFetchAllLists(workspaceId?: string | null): ListRow[] {
  const state = getState();
  return state.lists.filter((l) => (
    l.archived_at === null
    && (workspaceId == null || l.workspace_id === workspaceId)
  ));
}

export function localFetchBoardSnapshot(
  requestedBoardId?: string | null,
  workspaceId?: string | null,
): LocalBoardSnapshot {
  const state = getState();
  const boardRows = localFetchBoards(workspaceId);
  const activeBoard = boardRows.find((b) => b.id === requestedBoardId) || boardRows[0] || null;

  if (!activeBoard) {
    return { boardId: null, listRows: [], taskRows: [], checklistItemRows: [], labelRows: [], labelLinkRows: [] };
  }

  const listRows = state.lists.filter((l) => (
    l.board_id === activeBoard.id && l.archived_at === null
    && (workspaceId == null || l.workspace_id === workspaceId)
  ));
  const taskRows = state.tasks.filter((t) => (
    t.board_id === activeBoard.id && t.deleted_at === null && t.archived_at === null
    && (workspaceId == null || t.workspace_id === workspaceId)
  ));
  const taskIds = taskRows.map((t) => t.id);
  const checklistItemRows = state.checklistItems.filter((i) => taskIds.includes(i.task_id));
  const labelLinkRows = state.labelLinks.filter((l) => taskIds.includes(l.task_id));
  const labelIds = labelLinkRows.map((l) => l.label_id);
  const labelRows = state.labels.filter((l) => labelIds.includes(l.id));

  return { boardId: activeBoard.id, listRows, taskRows, checklistItemRows, labelRows, labelLinkRows };
}


export function localCreateBoard(boardInsert: BoardInsert): BoardRow {
  const state = getState();
  const boardRow: BoardRow = {
    id: createLocalId('board'),
    workspace_id: boardInsert.workspace_id ?? LOCAL_MOCK_WORKSPACE_ID,
    title: boardInsert.title,
    description: boardInsert.description ?? null,
    created_by: boardInsert.created_by ?? null,
    created_at: nowIso(),
    updated_at: null,
    archived_at: null,
  };
  state.boards.push(boardRow);
  saveState();
  return boardRow;
}

export function localCreateBoardFromTemplate(params: {
  title: string;
  description: string;
  templateId: string;
  workspaceId?: string | null;
  createdBy?: string | null;
}): BoardRow {
  const boardTemplate = findBoardTemplateById(params.templateId);
  if (!boardTemplate) {
    throw new Error(ERROR_MESSAGES.INVALID_TEMPLATE);
  }

  const state = getState();
  const workspaceId = params.workspaceId ?? LOCAL_MOCK_WORKSPACE_ID;
  const boardRow: BoardRow = {
    id: createLocalId('board'),
    workspace_id: workspaceId,
    title: params.title,
    description: params.description || boardTemplate.description,
    created_by: params.createdBy ?? null,
    created_at: nowIso(),
    updated_at: null,
    archived_at: null,
  };
  state.boards.push(boardRow);

  // Create the template lists so the board is immediately usable, mirroring
  // the Supabase branch of createBoardFromTemplate. Previously the local
  // branch created only the board row and dropped every template list.
  boardTemplate.lists.forEach((listTitle, index) => {
    state.lists.push({
      id: createLocalId('list'),
      workspace_id: workspaceId,
      board_id: boardRow.id,
      title: listTitle,
      position: index * LIST_POSITION_STEP,
      created_at: nowIso(),
      updated_at: null,
      archived_at: null,
    });
  });

  saveState();
  return boardRow;
}

export function localCreateList(listInsert: ListInsert): ListRow {
  const state = getState();
  const maxPos = state.lists
    .filter((l) => l.board_id === listInsert.board_id)
    .reduce((max, l) => Math.max(max, l.position), 0);
  const listRow: ListRow = {
    id: createLocalId('list'),
    workspace_id: listInsert.workspace_id ?? LOCAL_MOCK_WORKSPACE_ID,
    board_id: listInsert.board_id,
    title: listInsert.title,
    position: listInsert.position ?? maxPos + LIST_POSITION_STEP,
    created_at: nowIso(),
    updated_at: null,
    archived_at: null,
  };
  state.lists.push(listRow);
  saveState();
  return listRow;
}

export function localDeleteList(listId: string): void {
  const state = getState();
  const now = nowIso();
  state.lists = state.lists.filter((l) => l.id !== listId);
  state.tasks = state.tasks.map((t) => (
    t.list_id === listId ? { ...t, deleted_at: now } : t
  ));
  saveState();
}

export function localUpdateListPositions(positions: { id: string; position: number }[]): void {
  const state = getState();
  const posMap = new Map(positions.map((p) => [p.id, p.position]));
  state.lists = state.lists.map((l) => (
    posMap.has(l.id) ? { ...l, position: posMap.get(l.id)! } : l
  ));
  saveState();
}


export function localCreateTasks(taskInserts: TaskInsert[]): TaskRow[] {
  const state = getState();
  const now = nowIso();
  const created: TaskRow[] = taskInserts.map((taskInsert) => {
    const maxPos = state.tasks
      .filter((t) => t.list_id === taskInsert.list_id)
      .reduce((max, t) => Math.max(max, t.position), 0);
    const taskRow: TaskRow = {
      id: taskInsert.id ?? createLocalId('task'),
      board_id: taskInsert.board_id,
      list_id: taskInsert.list_id,
      workspace_id: taskInsert.workspace_id ?? LOCAL_MOCK_WORKSPACE_ID,
      title: taskInsert.title,
      description: taskInsert.description ?? null,
      assignees: taskInsert.assignees ?? [],
      priority: taskInsert.priority ?? DEFAULT_TASK_PRIORITY,
      start_date: taskInsert.start_date ?? null,
      due_date: taskInsert.due_date ?? null,
      category1: taskInsert.category1 ?? DEFAULT_TASK_CATEGORIES.CATEGORY_1,
      category2: taskInsert.category2 ?? DEFAULT_TASK_CATEGORIES.CATEGORY_2,
      image: taskInsert.image ?? null,
      is_done: taskInsert.is_done ?? false,
      repeat_interval: taskInsert.repeat_interval ?? null,
      attachments: taskInsert.attachments ?? [],
      position: taskInsert.position ?? maxPos + LIST_POSITION_STEP,
      created_by: taskInsert.created_by ?? null,
      deleted_at: null,
      archived_at: null,
      completed_at: taskInsert.is_done ? now : null,
      updated_at: now,
      created_at: now,
    };
    state.tasks.push(taskRow);
    return taskRow;
  });
  // Persist after ALL task rows are added so the batch survives a refresh.
  // (Previously this was omitted, so local task creation was lost on reload.)
  saveState();
  return created;
}

export function localUpdateTask(taskId: string, taskUpdate: TaskUpdate): TaskRow {
  const state = getState();
  const index = state.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) throw new Error('Task was not found.');
  const now = nowIso();
  const current = state.tasks[index];
  const updated: TaskRow = { ...current, updated_at: now };
  for (const key of Object.keys(taskUpdate)) {
    const value = (taskUpdate as Record<string, unknown>)[key];
    if (value !== undefined && key in current) {
      (updated as Record<string, unknown>)[key] = value;
    }
  }
  if (taskUpdate.is_done !== undefined) {
    updated.completed_at = taskUpdate.is_done ? (current.completed_at ?? now) : null;
  }
  if (taskUpdate.attachments !== undefined) updated.attachments = taskUpdate.attachments;
  state.tasks[index] = updated;
  saveState();
  return updated;
}

export function localDeleteTask(taskId: string): void {
  const state = getState();
  const now = nowIso();
  state.tasks = state.tasks.map((t) => (
    t.id === taskId ? { ...t, deleted_at: now } : t
  ));
  saveState();
}

export function localRestoreTask(taskId: string): TaskRow {
  return localUpdateTask(taskId, { deleted_at: null });
}

export function localDeleteTasksByListId(listId: string): void {
  const state = getState();
  const now = nowIso();
  state.tasks = state.tasks.map((t) => (
    t.list_id === listId ? { ...t, deleted_at: now } : t
  ));
  saveState();
}

export function localUpdateTaskPositions(
  positions: { id: string; list_id: string; position: number }[],
): void {
  const state = getState();
  const posMap = new Map(positions.map((p) => [p.id, p]));
  const now = nowIso();
  state.tasks = state.tasks.map((t) => {
    const update = posMap.get(t.id);
    return update ? { ...t, list_id: update.list_id, position: update.position, updated_at: now } : t;
  });
  saveState();
}


export function localReplaceChecklistItems(
  taskId: string,
  items: BoardTaskItem['checklistItems'],
  workspaceId?: string | null,
): void {
  const state = getState();
  state.checklistItems = state.checklistItems.filter((i) => i.task_id !== taskId);
  items.forEach((item, index) => {
    state.checklistItems.push({
      id: item.id,
      task_id: taskId,
      content: item.text,
      is_done: item.isDone,
      position: index,
      workspace_id: workspaceId ?? LOCAL_MOCK_WORKSPACE_ID,
      created_at: nowIso(),
      updated_at: null,
    });
  });
  saveState();
}

export function localReplaceLabels(
  taskId: string,
  boardId: string,
  labels: BoardTaskItem['labels'],
  workspaceId?: string | null,
): void {
  const state = getState();
  const wsId = workspaceId ?? LOCAL_MOCK_WORKSPACE_ID;
  labels.forEach((label) => {
    const existing = state.labels.find((l) => l.board_id === boardId && l.name === label.name);
    if (existing) {
      existing.color = label.color;
      existing.updated_at = nowIso();
    } else {
      state.labels.push({
        id: label.id,
        board_id: boardId,
        workspace_id: wsId,
        name: label.name,
        color: label.color,
        created_at: nowIso(),
        updated_at: null,
      });
    }
  });
  state.labelLinks = state.labelLinks.filter((l) => l.task_id !== taskId);
  labels.forEach((label) => {
    const labelRow = state.labels.find((l) => l.board_id === boardId && l.name === label.name);
    if (labelRow) {
      state.labelLinks.push({
        task_id: taskId,
        label_id: labelRow.id,
        workspace_id: wsId,
        created_at: nowIso(),
      });
    }
  });
  saveState();
}

export function localCreateActivity(activityInsert: TaskActivityInsert): TaskActivityRow {
  const state = getState();
  const row: TaskActivityRow = {
    id: createLocalId('act'),
    task_id: activityInsert.task_id,
    task_title: activityInsert.task_title ?? null,
    action: activityInsert.action,
    details: activityInsert.details,
    actor: activityInsert.actor,
    actor_id: activityInsert.actor_id ?? null,
    board_id: activityInsert.board_id ?? null,
    workspace_id: activityInsert.workspace_id ?? null,
    created_at: activityInsert.created_at ?? nowIso(),
  };
  state.activities.unshift(row);
  saveState();
  return row;
}

export function localFetchActivitiesForTask(taskId: string): TaskActivityRow[] {
  const state = getState();
  return state.activities
    .filter((a) => a.task_id === taskId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function localFetchBoardActivities(boardId: string): TaskActivityRow[] {
  const state = getState();
  return state.activities
    .filter((a) => a.board_id === boardId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function localFetchBriefingPins(workspaceId: string): BriefingPinRow[] {
  return getState().briefingPins
    .filter((pin) => pin.workspace_id === workspaceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function localCreateBriefingPin(input: BriefingPinInsert): BriefingPinRow {
  const state = getState();
  const timestamp = nowIso();
  const row: BriefingPinRow = {
    id: input.id ?? createLocalId('pin'),
    workspace_id: input.workspace_id,
    created_by: input.created_by,
    source_type: input.source_type,
    source_label: input.source_label,
    author_name: input.author_name,
    quoted_text: input.quoted_text,
    link_url: input.link_url ?? null,
    task_id: input.task_id ?? null,
    why_matters: input.why_matters,
    pinned_at: input.pinned_at ?? timestamp,
    created_at: input.created_at ?? timestamp,
  };
  state.briefingPins.unshift(row);
  saveState();
  return row;
}

export function localDeleteBriefingPin(pinId: string): void {
  const state = getState();
  state.briefingPins = state.briefingPins.filter((pin) => pin.id !== pinId);
  saveState();
}
