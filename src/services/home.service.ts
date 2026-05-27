import { endOfMonth, format, startOfMonth } from 'date-fns';

import { data as seedBoardData } from '../data';
import { CURRENT_USER } from '../data/currentUser';
import { VIETNAM_HOLIDAYS_2026, mapVietnamHolidayToRow } from '../data/vietnamHolidays';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { TaskAssignee } from '../types/task.type';
import type { HolidayRow } from '../types/supabase.type';
import { normalizeTaskAssignees } from '../utils/taskCollections';

export interface HomeTaskSummary {
  id: string;
  boardId: string;
  boardTitle: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
  dueDate: string | null;
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

function isAssignedToCurrentUser(assignees: TaskAssignee[], currentUserName: string) {
  return assignees.some((assignee) => assignee.name === currentUserName);
}

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

function getLocalDashboardData(): HomeDashboardData {
  const boardTitle = 'HVAC Editor';
  const tasks = Object.values(seedBoardData.task);
  const myTasks = tasks
    .filter((task) => isAssignedToCurrentUser(task.assignees, CURRENT_USER.name))
    .map<HomeTaskSummary>((task) => ({
      id: task.id,
      boardId: 'local-mock-board',
      boardTitle,
      title: task.title,
      priority: task.priority || null,
      dueDate: task.dueDate || null,
    }))
    .sort(sortTasksByDueDate);

  const memberAvatars = Array.from(new Set(tasks.flatMap((task) => task.assignees.map((assignee) => assignee.avatar))));

  return {
    myTasks,
    recentBoards: [{
      id: 'local-mock-board',
      title: boardTitle,
      description: 'Local demo board',
      taskCount: tasks.length,
      memberAvatars: memberAvatars.slice(0, 5),
      updatedAt: new Date().toISOString(),
    }],
    holidays: fallbackVietnamHolidays,
  };
}

export async function fetchHomeDashboardData(currentUserName = CURRENT_USER.name): Promise<HomeDashboardData> {
  if (!supabase) {
    return getLocalDashboardData();
  }

  const client = requireSupabaseClient();
  const visibleMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const visibleMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const [boardsResult, tasksResult] = await Promise.all([
    client
      .from('boards')
      .select('id,title,description,created_at,updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(6),
    client
      .from('tasks')
      .select('id,board_id,title,priority,due_date,assignees')
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ]);

  if (boardsResult.error) {
    throw boardsResult.error;
  }

  if (tasksResult.error) {
    throw tasksResult.error;
  }

  const boards = boardsResult.data as DashboardBoardRow[];
  const tasks = tasksResult.data as DashboardTaskRow[];
  const boardTitleById = new Map(boards.map((board) => [board.id, board.title]));
  let holidays = fallbackVietnamHolidays.filter((holiday) => (
    holiday.date >= visibleMonthStart && holiday.date <= visibleMonthEnd
  ));

  if (import.meta.env.VITE_ENABLE_HOLIDAYS_TABLE === 'true') {
    const holidaysResult = await client
      .from('holidays')
      .select('id,name,date,country_code,created_at')
      .eq('country_code', 'VN')
      .gte('date', visibleMonthStart)
      .lte('date', visibleMonthEnd)
      .order('date', { ascending: true });

    if (!holidaysResult.error && holidaysResult.data.length > 0) {
      holidays = holidaysResult.data;
    } else if (holidaysResult.error && import.meta.env.DEV) {
      console.warn('[HomeDashboard] Falling back to local holiday data.', holidaysResult.error);
    }
  }

  const myTasks = tasks
    .filter((task) => isAssignedToCurrentUser(normalizeTaskAssignees(task.assignees), currentUserName))
    .map<HomeTaskSummary>((task) => ({
      id: task.id,
      boardId: task.board_id,
      boardTitle: boardTitleById.get(task.board_id) || 'Untitled board',
      title: task.title,
      priority: task.priority,
      dueDate: task.due_date,
    }))
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
