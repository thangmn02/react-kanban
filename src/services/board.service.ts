import { data as seedBoardData } from '../data';
import supabase from '../lib/supabase';
import type { BoardData } from '../types/task.type';
import type { BoardInsert, BoardRow, ListRow, TaskInsert, TaskRow } from '../types/supabase.type';
import { buildBoardDataFromRows } from '../utils/boardDataMapper';

export interface BoardSnapshot {
  boardId: string | null;
  boardData: BoardData;
}

async function createBoard(boardData: BoardInsert): Promise<BoardRow> {
  const { data, error } = await supabase
    .from('boards')
    .insert(boardData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchBoardRows(): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function fetchLists(boardId: string): Promise<ListRow[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function fetchTasksForBoard(boardId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('board_id', boardId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function seedDefaultBoard(): Promise<BoardRow> {
  const boardRow = await createBoard({
    title: 'HVAC Editor',
    description: 'Seeded Kanban board',
  });

  const listIdMap = new Map<string, string>();

  for (const [listPosition, sourceListId] of seedBoardData.columns.entries()) {
    const sourceList = seedBoardData.list[sourceListId];
    const { data: insertedList, error: listError } = await supabase
      .from('lists')
      .insert({
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

  seedBoardData.columns.forEach((sourceListId) => {
    const sourceList = seedBoardData.list[sourceListId];
    const destinationListId = listIdMap.get(sourceListId);

    if (!destinationListId) return;

    sourceList.tasks.forEach((taskId, taskPosition) => {
      const sourceTask = seedBoardData.task[taskId];

      taskInserts.push({
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
    });
  });

  if (taskInserts.length) {
    const { error } = await supabase
      .from('tasks')
      .insert(taskInserts);

    if (error) {
      throw error;
    }
  }

  return boardRow;
}

export async function fetchBoardSnapshot(): Promise<BoardSnapshot> {
  if (!supabase) {
    return {
      boardId: 'local-mock-board',
      boardData: seedBoardData,
    };
  }

  const boardRows = await fetchBoardRows();
  let activeBoard = boardRows[0];

  if (!activeBoard) {
    activeBoard = await seedDefaultBoard();
  }

  const [listRows, taskRows] = await Promise.all([
    fetchLists(activeBoard.id),
    fetchTasksForBoard(activeBoard.id),
  ]);

  return {
    boardId: activeBoard.id,
    boardData: buildBoardDataFromRows(listRows, taskRows),
  };
}
