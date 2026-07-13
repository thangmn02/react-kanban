import { endOfDay, startOfDay } from 'date-fns';

import supabase, { requireSupabaseClient } from '../lib/supabase';
import { readScopedJSON, writeScopedJSON, type StorageScope } from '../shared/storage/storageAdapter';
import type {
  DailyFocusStats,
  FocusSessionLogInput,
  FocusSessionSummary,
  FocusSessionStatus,
  PomodoroMode,
} from '../types/focus.type';

interface FocusSessionRow {
  id: string;
  workspace_id: string;
  board_id: string | null;
  task_id: string | null;
  user_id: string;
  mode: PomodoroMode;
  status: FocusSessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  planned_seconds: number;
  created_at: string;
}

interface FocusSessionsSelectQuery {
  eq(column: string, value: string): FocusSessionsSelectQuery;
  gte(column: string, value: string): FocusSessionsSelectQuery;
  lte(column: string, value: string): FocusSessionsSelectQuery;
  order(column: string, options: { ascending: boolean }): FocusSessionsSelectQuery;
  limit(count: number): Promise<{ data: FocusSessionRow[] | null; error: Error | null }>;
  then<TResult1 = { data: FocusSessionRow[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FocusSessionRow[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

interface FocusSessionsInsertQuery {
  select(columns?: string): {
    single(): Promise<{ data: FocusSessionRow | null; error: Error | null }>;
  };
}

interface FocusSessionsTableClient {
  select(columns: string): FocusSessionsSelectQuery;
  insert(payload: Record<string, unknown>): FocusSessionsInsertQuery;
}

interface FocusSessionsClient {
  from(table: 'focus_sessions'): FocusSessionsTableClient;
}

const MOCK_FOCUS_SCOPE: StorageScope = { userId: 'mock-user', workspaceId: 'local-mock-workspace' };
const focusSessionSelectColumns = 'id,workspace_id,board_id,task_id,user_id,mode,status,started_at,ended_at,duration_seconds,planned_seconds,created_at';

function getFocusSessionsClient(): FocusSessionsClient {
  return requireSupabaseClient() as unknown as FocusSessionsClient;
}

function readLocalFocusSessions(): FocusSessionSummary[] {
  return readScopedJSON<FocusSessionSummary[]>(MOCK_FOCUS_SCOPE, 'focus_sessions', []);
}

function writeLocalFocusSessions(sessions: FocusSessionSummary[]) {
  writeScopedJSON(MOCK_FOCUS_SCOPE, 'focus_sessions', sessions);
}

function mapFocusSessionRow(row: FocusSessionRow): FocusSessionSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    boardId: row.board_id,
    taskId: row.task_id,
    userId: row.user_id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    plannedSeconds: row.planned_seconds,
    createdAt: row.created_at,
  };
}

function isSameDay(dateValue: string, targetDate: Date) {
  const date = new Date(dateValue);
  return date >= startOfDay(targetDate) && date <= endOfDay(targetDate);
}

function buildDailyFocusStats(sessions: FocusSessionSummary[]): DailyFocusStats {
  const completedFocusSessions = sessions.filter((session) => (
    session.mode === 'focus' && session.status === 'completed'
  ));
  const interruptedFocusSessions = sessions.filter((session) => (
    session.mode === 'focus' && session.status === 'interrupted'
  ));

  return {
    focusedMinutes: Math.round(
      completedFocusSessions.reduce((total, session) => total + session.durationSeconds, 0) / 60
    ),
    completedSessions: completedFocusSessions.length,
    interruptedSessions: interruptedFocusSessions.length,
    topTaskTitle: null,
  };
}

export async function logFocusSession(input: FocusSessionLogInput): Promise<FocusSessionSummary> {
  const payload = {
    workspace_id: input.workspaceId,
    board_id: input.boardId ?? null,
    task_id: input.taskId ?? null,
    user_id: input.userId,
    mode: input.mode,
    status: input.status,
    started_at: input.startedAt,
    ended_at: input.endedAt ?? null,
    duration_seconds: input.durationSeconds,
    planned_seconds: input.plannedSeconds,
  };

  if (!supabase) {
    const localSession: FocusSessionSummary = {
      id: `focus-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: input.workspaceId,
      boardId: input.boardId ?? null,
      taskId: input.taskId ?? null,
      userId: input.userId,
      mode: input.mode,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationSeconds: input.durationSeconds,
      plannedSeconds: input.plannedSeconds,
      createdAt: new Date().toISOString(),
    };
    writeLocalFocusSessions([localSession, ...readLocalFocusSessions()]);
    return localSession;
  }

  const client = getFocusSessionsClient();
  const { data, error } = await client
    .from('focus_sessions')
    .insert(payload)
    .select(focusSessionSelectColumns)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Focus session was not logged.');
  }

  return mapFocusSessionRow(data);
}

export async function fetchDailyFocusStats(
  workspaceId: string | null,
  userId: string | null,
  date = new Date(),
): Promise<DailyFocusStats> {
  if (!workspaceId || !userId) {
    return buildDailyFocusStats([]);
  }

  if (!supabase) {
    return buildDailyFocusStats(readLocalFocusSessions().filter((session) => (
      session.workspaceId === workspaceId
      && session.userId === userId
      && isSameDay(session.createdAt, date)
    )));
  }

  const client = getFocusSessionsClient();
  const { data, error } = await client
    .from('focus_sessions')
    .select(focusSessionSelectColumns)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .gte('created_at', startOfDay(date).toISOString())
    .lte('created_at', endOfDay(date).toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return buildDailyFocusStats((data || []).map(mapFocusSessionRow));
}

export async function fetchFocusSessionsForTask(
  workspaceId: string | null,
  taskId: string,
): Promise<FocusSessionSummary[]> {
  if (!workspaceId) {
    return [];
  }

  if (!supabase) {
    return readLocalFocusSessions()
      .filter((session) => session.workspaceId === workspaceId && session.taskId === taskId)
      .sort((current, next) => next.createdAt.localeCompare(current.createdAt))
      .slice(0, 6);
  }

  const client = getFocusSessionsClient();
  const { data, error } = await client
    .from('focus_sessions')
    .select(focusSessionSelectColumns)
    .eq('workspace_id', workspaceId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    throw error;
  }

  return (data || []).map(mapFocusSessionRow);
}
