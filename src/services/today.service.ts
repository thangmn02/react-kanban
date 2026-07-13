import { isToday, isBefore, parseISO, startOfToday } from 'date-fns';

import { DEFAULT_BOARD_TITLE } from '../constants';
import {
  LOCAL_MOCK_WORKSPACE_ID,
  localFetchAllLists,
  localFetchAllTasks,
  localFetchBoards,
} from '../infrastructure/local/localBoardStore';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { AppUser } from '../types/auth.type';
import type { BoardTaskItem } from '../types/task.type';
import { isTaskAssignedToUser } from '../utils/taskAssignment';
import { normalizeTaskAssignees } from '../utils/taskCollections';

export interface TodayTaskSummary {
  id: string;
  boardId: string;
  boardTitle: string;
  listId: string;
  listTitle: string;
  title: string;
  description: string;
  priority: BoardTaskItem['priority'] | null;
  dueDate: string | null;
  assigneeAvatar?: string;
  isDone: boolean;
  updatedAt: string | null;
}

export interface TodayPageData {
  overdueTasks: TodayTaskSummary[];
  dueTodayTasks: TodayTaskSummary[];
  assignedTasks: TodayTaskSummary[];
  recentlyActiveTasks: TodayTaskSummary[];
}

interface TodayBoardRow {
  id: string;
  title: string;
}

interface TodayListRow {
  id: string;
  board_id: string;
  title: string;
}

interface TodayTaskRow {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  priority: TodayTaskSummary['priority'];
  due_date: string | null;
  assignees: unknown;
  is_done: boolean | null;
  updated_at: string | null;
  created_at: string;
}

interface FetchTodayPageDataParams {
  currentUser: AppUser;
  workspaceId: string | null;
}

function isOverdueTask(task: TodayTaskSummary) {
  if (!task.dueDate || task.isDone) {
    return false;
  }

  const dueDate = parseISO(task.dueDate);
  return isBefore(dueDate, startOfToday()) && !isToday(dueDate);
}

function isDueTodayTask(task: TodayTaskSummary) {
  return Boolean(task.dueDate && !task.isDone && isToday(parseISO(task.dueDate)));
}

function sortByDueDate(currentTask: TodayTaskSummary, nextTask: TodayTaskSummary) {
  if (!currentTask.dueDate && !nextTask.dueDate) {
    return currentTask.title.localeCompare(nextTask.title);
  }

  if (!currentTask.dueDate) {
    return 1;
  }

  if (!nextTask.dueDate) {
    return -1;
  }

  return currentTask.dueDate.localeCompare(nextTask.dueDate) || currentTask.title.localeCompare(nextTask.title);
}

function sortByActivity(currentTask: TodayTaskSummary, nextTask: TodayTaskSummary) {
  const currentUpdatedAt = currentTask.updatedAt || '';
  const nextUpdatedAt = nextTask.updatedAt || '';
  return nextUpdatedAt.localeCompare(currentUpdatedAt);
}

function getLocalTodayData(currentUser: AppUser): TodayPageData {
  const boards = localFetchBoards(LOCAL_MOCK_WORKSPACE_ID);
  const lists = localFetchAllLists(LOCAL_MOCK_WORKSPACE_ID);
  const tasks = localFetchAllTasks(LOCAL_MOCK_WORKSPACE_ID);
  const boardTitleById = new Map(boards.map((board) => [board.id, board.title]));
  const listById = new Map(lists.map((list) => [list.id, list]));

  const assignedTasks = tasks
    .filter((task) => isTaskAssignedToUser(normalizeTaskAssignees(task.assignees), currentUser))
    .map<TodayTaskSummary>((task) => {
      const assignees = normalizeTaskAssignees(task.assignees);
      const list = listById.get(task.list_id);

      return {
        id: task.id,
        boardId: task.board_id,
        boardTitle: boardTitleById.get(task.board_id) || DEFAULT_BOARD_TITLE,
        listId: task.list_id,
        listTitle: list?.title || 'Untitled list',
        title: task.title,
        description: task.description || '',
        priority: task.priority as TodayTaskSummary['priority'],
        dueDate: task.due_date,
        assigneeAvatar: assignees[0]?.avatar,
        isDone: Boolean(task.is_done),
        updatedAt: task.updated_at || task.created_at,
      };
    });

  return {
    overdueTasks: assignedTasks.filter(isOverdueTask).sort(sortByDueDate),
    dueTodayTasks: assignedTasks.filter(isDueTodayTask).sort(sortByDueDate),
    assignedTasks: [...assignedTasks].sort(sortByDueDate).slice(0, 12),
    recentlyActiveTasks: [...assignedTasks].sort(sortByActivity).slice(0, 8),
  };
}

export async function fetchTodayPageData({
  currentUser,
  workspaceId,
}: FetchTodayPageDataParams): Promise<TodayPageData> {
  if (!supabase) {
    return getLocalTodayData(currentUser);
  }

  if (!workspaceId) {
    return {
      overdueTasks: [],
      dueTodayTasks: [],
      assignedTasks: [],
      recentlyActiveTasks: [],
    };
  }

  const client = requireSupabaseClient();
  const [boardsResult, listsResult, tasksResult] = await Promise.all([
    client
      .from('boards')
      .select('id,title')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    client
      .from('lists')
      .select('id,board_id,title')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),
    client
      .from('tasks')
      .select('id,board_id,list_id,title,description,priority,due_date,assignees,is_done,updated_at,created_at')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false }),
  ]);

  if (boardsResult.error) {
    throw boardsResult.error;
  }

  if (listsResult.error) {
    throw listsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  const boardTitleById = new Map(((boardsResult.data ?? []) as TodayBoardRow[]).map((board) => [board.id, board.title]));
  const listById = new Map(((listsResult.data ?? []) as TodayListRow[]).map((list) => [list.id, list]));

  const assignedTasks = ((tasksResult.data ?? []) as TodayTaskRow[])
    .filter((task) => isTaskAssignedToUser(normalizeTaskAssignees(task.assignees), currentUser))
    .map<TodayTaskSummary>((task) => {
      const assignees = normalizeTaskAssignees(task.assignees);
      const list = listById.get(task.list_id);

      return {
        id: task.id,
        boardId: task.board_id,
        boardTitle: boardTitleById.get(task.board_id) || 'Untitled board',
        listId: task.list_id,
        listTitle: list?.title || 'Untitled list',
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.due_date,
        assigneeAvatar: assignees[0]?.avatar,
        isDone: Boolean(task.is_done),
        updatedAt: task.updated_at || task.created_at,
      };
    });

  return {
    overdueTasks: assignedTasks.filter(isOverdueTask).sort(sortByDueDate),
    dueTodayTasks: assignedTasks.filter(isDueTodayTask).sort(sortByDueDate),
    assignedTasks: [...assignedTasks].sort(sortByDueDate).slice(0, 12),
    recentlyActiveTasks: [...assignedTasks].sort(sortByActivity).slice(0, 8),
  };
}
