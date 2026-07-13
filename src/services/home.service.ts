import { endOfMonth, format, startOfMonth } from 'date-fns';

import { DEFAULT_BOARD_TITLE } from '../constants';
import { VIETNAM_HOLIDAYS_2026, mapVietnamHolidayToRow } from '../data/vietnamHolidays';
import {
  LOCAL_MOCK_WORKSPACE_ID,
  localFetchAllTasks,
  localFetchBoards,
} from '../infrastructure/local/localBoardStore';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { AppUser } from '../types/auth.type';
import type { HolidayRow, TaskRow } from '../types/supabase.type';
import { isTaskAssignedToUser } from '../utils/taskAssignment';
import { normalizeTaskAssignees } from '../utils/taskCollections';

export interface HomeTaskSummary {
  id: string;
  boardId: string;
  boardTitle: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
  dueDate: string | null;
  assigneeAvatar?: string;
}

export interface RecentBoardSummary {
  id: string;
  title: string;
  description: string | null;
  taskCount: number;
  memberAvatars: string[];
  updatedAt: string | null;
}

export interface HomeDashboardData {
  myTasks: HomeTaskSummary[];
  recentBoards: RecentBoardSummary[];
  holidays: HolidayRow[];
}

interface DashboardTaskRow {
  id: string;
  board_id: string;
  title: string;
  priority: HomeTaskSummary['priority'];
  due_date: string | null;
  assignees: unknown;
}

interface DashboardBoardRow {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

const fallbackVietnamHolidays: HolidayRow[] = VIETNAM_HOLIDAYS_2026.map(mapVietnamHolidayToRow);

function sortTasksByDueDate(currentTask: HomeTaskSummary, nextTask: HomeTaskSummary) {
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

function getLocalDashboardData(currentUser: AppUser | null): HomeDashboardData {
  const boards = localFetchBoards(LOCAL_MOCK_WORKSPACE_ID);
  const tasks = localFetchAllTasks(LOCAL_MOCK_WORKSPACE_ID);
  const boardTitleById = new Map(boards.map((board) => [board.id, board.title]));

  const myTasks = tasks
    .filter((task) => isTaskAssignedToUser(normalizeTaskAssignees(task.assignees), currentUser))
    .map<HomeTaskSummary>((task) => {
      const assignees = normalizeTaskAssignees(task.assignees);
      return {
        id: task.id,
        boardId: task.board_id,
        boardTitle: boardTitleById.get(task.board_id) || DEFAULT_BOARD_TITLE,
        title: task.title,
        priority: task.priority as HomeTaskSummary['priority'],
        dueDate: task.due_date,
        assigneeAvatar: assignees[0]?.avatar,
      };
    })
    .sort(sortTasksByDueDate)
    .slice(0, 12);

  const tasksByBoardId = tasks.reduce<Map<string, TaskRow[]>>((taskMap, task) => {
    const currentTasks = taskMap.get(task.board_id) || [];
    currentTasks.push(task);
    taskMap.set(task.board_id, currentTasks);
    return taskMap;
  }, new Map());

  const recentBoards = boards.map<RecentBoardSummary>((board) => {
    const boardTasks = tasksByBoardId.get(board.id) || [];
    const memberAvatars = Array.from(new Set(boardTasks.flatMap((task) => (
      normalizeTaskAssignees(task.assignees).map((assignee) => assignee.avatar)
    ))));

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      taskCount: boardTasks.length,
      memberAvatars: memberAvatars.slice(0, 5),
      updatedAt: board.updated_at || board.created_at,
    };
  });

  return {
    myTasks,
    recentBoards,
    holidays: fallbackVietnamHolidays,
  };
}

interface FetchHomeDashboardDataParams {
  currentUser?: AppUser | null;
  workspaceId?: string | null;
}

export async function fetchHomeDashboardData({
  currentUser,
  workspaceId,
}: FetchHomeDashboardDataParams = {}): Promise<HomeDashboardData> {
  if (!supabase) {
    return getLocalDashboardData(currentUser ?? null);
  }

  const client = requireSupabaseClient();
  const visibleMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const visibleMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  let boardsQuery = client
    .from('boards')
    .select('id,title,description,created_at,updated_at')
    .is('archived_at', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(6);
  let tasksQuery = client
    .from('tasks')
    .select('id,board_id,title,priority,due_date,assignees')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (workspaceId) {
    boardsQuery = boardsQuery.eq('workspace_id', workspaceId);
    tasksQuery = tasksQuery.eq('workspace_id', workspaceId);
  }

  const [boardsResult, tasksResult] = await Promise.all([
    boardsQuery,
    tasksQuery,
  ]);

  if (boardsResult.error) {
    throw boardsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  const boards = (boardsResult.data ?? []) as DashboardBoardRow[];
  const tasks = (tasksResult.data ?? []) as DashboardTaskRow[];
  const boardTitleById = new Map(boards.map((board) => [board.id, board.title]));
  let holidays = fallbackVietnamHolidays.filter((holiday) => (
    holiday.date >= visibleMonthStart && holiday.date <= visibleMonthEnd
  ));

  if (import.meta.env.VITE_ENABLE_HOLIDAYS_TABLE === 'true') {
    const holidaysClient = client as unknown as {
      from: (table: 'holidays') => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            gte: (column: string, value: string) => {
              lte: (column: string, value: string) => {
                order: (column: string, options: { ascending: boolean }) => Promise<{
                  data: HolidayRow[] | null;
                  error: Error | null;
                }>;
              };
            };
          };
        };
      };
    };
    const holidaysResult = await holidaysClient
      .from('holidays')
      .select('id,name,date,country_code,created_at')
      .eq('country_code', 'VN')
      .gte('date', visibleMonthStart)
      .lte('date', visibleMonthEnd)
      .order('date', { ascending: true });

    if (!holidaysResult.error && holidaysResult.data && holidaysResult.data.length > 0) {
      holidays = holidaysResult.data;
    } else if (holidaysResult.error && import.meta.env.DEV) {
      console.warn('[HomeDashboard] Falling back to local holiday data.', holidaysResult.error);
    }
  }

  const myTasks = tasks
    .filter((task) => isTaskAssignedToUser(normalizeTaskAssignees(task.assignees), currentUser ?? null))
    .map<HomeTaskSummary>((task) => {
      const assignees = normalizeTaskAssignees(task.assignees);
      return {
        id: task.id,
        boardId: task.board_id,
        boardTitle: boardTitleById.get(task.board_id) || 'Untitled board',
        title: task.title,
        priority: task.priority,
        dueDate: task.due_date,
        assigneeAvatar: assignees[0]?.avatar,
      };
    })
    .sort(sortTasksByDueDate)
    .slice(0, 12);

  const tasksByBoardId = tasks.reduce<Map<string, DashboardTaskRow[]>>((taskMap, task) => {
    const currentTasks = taskMap.get(task.board_id) || [];
    currentTasks.push(task);
    taskMap.set(task.board_id, currentTasks);
    return taskMap;
  }, new Map());

  const recentBoards = boards.map<RecentBoardSummary>((board) => {
    const boardTasks = tasksByBoardId.get(board.id) || [];
    const memberAvatars = Array.from(new Set(boardTasks.flatMap((task) => (
      normalizeTaskAssignees(task.assignees).map((assignee) => assignee.avatar)
    ))));

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      taskCount: boardTasks.length,
      memberAvatars: memberAvatars.slice(0, 5),
      updatedAt: board.updated_at || board.created_at,
    };
  });

  return {
    myTasks,
    recentBoards,
    holidays,
  };
}
