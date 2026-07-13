import { DEFAULT_BOARD_TITLE, DEFAULT_TASK_PRIORITY, ERROR_MESSAGES, LIST_POSITION_STEP } from '../constants';
import { data as seedBoardData } from '../data';
import { findBoardTemplateById } from '../data/boardTemplates';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardData, ITaskItem } from '../types/task.type';
import type { BoardInsert, BoardRow, ListRow, TaskInsert, TaskRow } from '../types/supabase.type';
import { buildBoardDataFromRows } from '../utils/boardDataMapper';
import {
  localFetchBoards,
  localFetchBoardSnapshot,
  localCreateBoardFromTemplate,
} from '../infrastructure/local/localBoardStore';
import { fetchChecklistItemsByTaskIds, replaceTaskChecklistItems } from './checklist.service';
import { fetchLabelLinksByTaskIds, fetchLabelsByIds, replaceTaskLabels } from './label.service';

export interface BoardSnapshot {
  boardId: string | null;
  boardData: BoardData;
}

export interface CreateBoardFromTemplateParams {
  title: string;
  description: string;
  templateId: string;
  workspaceId?: string | null;
  createdBy?: string | null;
}

async function createBoard(boardData: BoardInsert): Promise<BoardRow> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('boards')
    .insert(boardData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Board was not created.');
  }

  return data;
}

export async function fetchBoards(workspaceId?: string | null): Promise<BoardRow[]> {
  if (!supabase) {
    return localFetchBoards(workspaceId);
  }

  const client = requireSupabaseClient();
  let query = client
    .from('boards')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchLists(boardId: string, workspaceId?: string | null): Promise<ListRow[]> {
  const client = requireSupabaseClient();
  let query = client
    .from('lists')
    .select('*')
    .eq('board_id', boardId)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchTasksForBoard(boardId: string, workspaceId?: string | null): Promise<TaskRow[]> {
  const client = requireSupabaseClient();
  let query = client
    .from('tasks')
    .select('*')
    .eq('board_id', boardId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

type SupabaseClient = ReturnType<typeof requireSupabaseClient>;

interface SeededTaskDetail {
  sourceTaskId: string;
  checklistItems: ITaskItem['checklistItems'];
  labels: ITaskItem['labels'];
}

async function seedBoardLists(
  client: SupabaseClient,
  boardRow: BoardRow,
  workspaceId?: string | null,
): Promise<Map<string, string>> {
  const listIdMap = new Map<string, string>();

  for (const [listPosition, sourceListId] of seedBoardData.columns.entries()) {
    const sourceList = seedBoardData.list[sourceListId];
    const { data: insertedList, error: listError } = await client
      .from('lists')
      .insert({
        workspace_id: workspaceId ?? boardRow.workspace_id,
        board_id: boardRow.id,
        title: sourceList.title,
        position: listPosition,
      })
      .select()
      .single();

    if (listError) {
      throw listError;
    }

    listIdMap.set(sourceListId, insertedList.id);
  }

  return listIdMap;
}

async function seedBoardTasks(
  client: SupabaseClient,
  boardRow: BoardRow,
  workspaceId: string | null | undefined,
  listIdMap: Map<string, string>,
): Promise<{ insertedTasks: TaskRow[]; seededTaskDetails: SeededTaskDetail[] }> {
  const taskInserts: TaskInsert[] = [];
  const seededTaskDetails: SeededTaskDetail[] = [];

  seedBoardData.columns.forEach((sourceListId) => {
    const sourceList = seedBoardData.list[sourceListId];
    const destinationListId = listIdMap.get(sourceListId);

    if (!destinationListId) return;

    sourceList.tasks.forEach((taskId, taskPosition) => {
      const sourceTask = seedBoardData.task[taskId];

      taskInserts.push({
        workspace_id: workspaceId ?? boardRow.workspace_id,
        board_id: boardRow.id,
        list_id: destinationListId,
        title: sourceTask.title,
        description: sourceTask.description,
        priority: sourceTask.priority || DEFAULT_TASK_PRIORITY,
        start_date: sourceTask.startDate || null,
        due_date: sourceTask.dueDate || null,
        category1: sourceTask.category1 || null,
        category2: sourceTask.category2 || null,
        assignees: sourceTask.assignees as unknown as TaskInsert['assignees'],
        image: sourceTask.image || null,
        is_done: sourceTask.isDone || false,
        position: taskPosition,
      });

      seededTaskDetails.push({
        sourceTaskId: taskId,
        checklistItems: sourceTask.checklistItems,
        labels: sourceTask.labels,
      });
    });
  });

  if (!taskInserts.length) {
    return { insertedTasks: [], seededTaskDetails };
  }

  const { data: insertedTasks, error } = await client
    .from('tasks')
    .insert(taskInserts)
    .select();

  if (error) {
    throw error;
  }

  return { insertedTasks: insertedTasks ?? [], seededTaskDetails };
}

async function seedTaskDetails(
  boardRow: BoardRow,
  insertedTasks: TaskRow[],
  seededTaskDetails: SeededTaskDetail[],
): Promise<void> {
  for (const [index, insertedTask] of insertedTasks.entries()) {
    const seededTaskDetail = seededTaskDetails[index];

    if (!seededTaskDetail) {
      continue;
    }

    await replaceTaskChecklistItems(insertedTask.id, seededTaskDetail.checklistItems);
    await replaceTaskLabels(insertedTask.id, boardRow.id, seededTaskDetail.labels);
  }
}

async function seedDefaultBoard(workspaceId?: string | null, createdBy?: string | null): Promise<BoardRow> {
  const client = requireSupabaseClient();
  const boardRow = await createBoard({
    workspace_id: workspaceId ?? undefined,
    title: DEFAULT_BOARD_TITLE,
    description: 'Seeded Kanban board',
    created_by: createdBy ?? undefined,
  });

  const listIdMap = await seedBoardLists(client, boardRow, workspaceId);
  const { insertedTasks, seededTaskDetails } = await seedBoardTasks(client, boardRow, workspaceId, listIdMap);
  await seedTaskDetails(boardRow, insertedTasks, seededTaskDetails);

  return boardRow;
}

export async function createBoardFromTemplate({
  title,
  description,
  templateId,
  workspaceId,
  createdBy,
}: CreateBoardFromTemplateParams): Promise<BoardRow> {
  if (!supabase) {
    return localCreateBoardFromTemplate({ title, description, templateId, workspaceId, createdBy });
  }

  const client = requireSupabaseClient();
  const boardTemplate = findBoardTemplateById(templateId);

  if (!boardTemplate) {
    throw new Error(ERROR_MESSAGES.INVALID_TEMPLATE);
  }

  const boardRow = await createBoard({
    workspace_id: workspaceId ?? undefined,
    title,
    description: description || boardTemplate.description,
    created_by: createdBy ?? undefined,
  });

  const templateLists = boardTemplate.lists.map((listTitle, index) => ({
    workspace_id: workspaceId ?? boardRow.workspace_id,
    board_id: boardRow.id,
    title: listTitle,
    position: index * LIST_POSITION_STEP,
  }));

  if (templateLists.length > 0) {
    const { error } = await client
      .from('lists')
      .insert(templateLists);

    if (error) {
      throw error;
    }
  }

  return boardRow;
}

export async function fetchBoardSnapshot(
  requestedBoardId?: string | null,
  workspaceId?: string | null,
  createdBy?: string | null,
  options: { seedIfMissing?: boolean } = {},
): Promise<BoardSnapshot> {
  if (!supabase) {
    const snapshot = localFetchBoardSnapshot(requestedBoardId, workspaceId);
    return {
      boardId: snapshot.boardId,
      boardData: buildBoardDataFromRows(
        snapshot.listRows,
        snapshot.taskRows,
        snapshot.checklistItemRows,
        snapshot.labelRows,
        snapshot.labelLinkRows,
      ),
    };
  }

  const boardRows = await fetchBoards(workspaceId);
  let activeBoard = boardRows.find((boardRow) => boardRow.id === requestedBoardId) || boardRows[0];

  if (!activeBoard && options.seedIfMissing !== false) {
    activeBoard = await seedDefaultBoard(workspaceId, createdBy);
  }

  if (!activeBoard) {
    return {
      boardId: null,
      boardData: buildBoardDataFromRows([], []),
    };
  }

  const [listRows, taskRows] = await Promise.all([
    fetchLists(activeBoard.id, workspaceId),
    fetchTasksForBoard(activeBoard.id, workspaceId),
  ]);
  const taskIds = taskRows.map((taskRow) => taskRow.id);
  const [checklistItemRows, taskLabelLinkRows] = await Promise.all([
    fetchChecklistItemsByTaskIds(taskIds),
    fetchLabelLinksByTaskIds(taskIds),
  ]);
  const taskLabelRows = await fetchLabelsByIds(taskLabelLinkRows.map((taskLabelLinkRow) => taskLabelLinkRow.label_id));

  return {
    boardId: activeBoard.id,
    boardData: buildBoardDataFromRows(
      listRows,
      taskRows,
      checklistItemRows,
      taskLabelRows,
      taskLabelLinkRows,
    ),
  };
}
