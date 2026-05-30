import { data as seedBoardData } from '../data';
import { getBoardTemplateById } from '../data/boardTemplates';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardData, ITaskItem } from '../types/task.type';
import type { BoardInsert, BoardRow, ListRow, TaskInsert, TaskRow } from '../types/supabase.type';
import { buildBoardDataFromRows } from '../utils/boardDataMapper';
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

  return data;
}

export async function fetchBoards(workspaceId?: string | null): Promise<BoardRow[]> {
  if (!supabase) {
    return [{
      id: 'local-mock-board',
      workspace_id: workspaceId ?? null,
      title: 'HVAC Editor',
      description: 'Local demo board',
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      archived_at: null,
    }];
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

  return data;
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

  return data;
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

async function seedDefaultBoard(workspaceId?: string | null, createdBy?: string | null): Promise<BoardRow> {
  const client = requireSupabaseClient();
  const boardRow = await createBoard({
    workspace_id: workspaceId ?? undefined,
    title: 'HVAC Editor',
    description: 'Seeded Kanban board',
    created_by: createdBy ?? undefined,
  });

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

  const taskInserts: TaskInsert[] = [];
  const seededTaskDetails: Array<{
    sourceTaskId: string;
    checklistItems: ITaskItem['checklistItems'];
    labels: ITaskItem['labels'];
  }> = [];

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
        priority: sourceTask.priority || 'Low',
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

  if (taskInserts.length) {
    const { data: insertedTasks, error } = await client
      .from('tasks')
      .insert(taskInserts)
      .select();

    if (error) {
      throw error;
    }

    for (const [index, insertedTask] of insertedTasks.entries()) {
      const seededTaskDetail = seededTaskDetails[index];

      if (!seededTaskDetail) {
        continue;
      }

      await replaceTaskChecklistItems(insertedTask.id, seededTaskDetail.checklistItems);
      await replaceTaskLabels(insertedTask.id, boardRow.id, seededTaskDetail.labels);
    }
  }

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
    return {
      id: `board-${Date.now()}`,
      workspace_id: workspaceId ?? null,
      title,
      description,
      created_by: createdBy ?? null,
      created_at: new Date().toISOString(),
      updated_at: null,
      archived_at: null,
    };
  }

  const client = requireSupabaseClient();
  const boardTemplate = getBoardTemplateById(templateId);
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
    position: index * 1000,
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
    return {
      boardId: 'local-mock-board',
      boardData: seedBoardData,
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
