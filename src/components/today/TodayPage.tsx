import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { fetchTodayPageData, type TodayPageData, type TodayTaskSummary } from '../../services/today.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import type { DailyFocusStats, FocusTask } from '../../types/focus.type';
import AppleCard from '../atoms/AppleCard';
import TodayTaskSection from './TodayTaskSection';
import TodayTaskCard from './TodayTaskCard';

interface TodayPageProps {
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  focusTasks: FocusTask[];
  dailyFocusStats: DailyFocusStats;
  isFocusTask: (taskId: string) => boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onQuickCreateTask: () => void;
}

function getEmptyTodayData(): TodayPageData {
  return {
    overdueTasks: [],
    dueTodayTasks: [],
    assignedTasks: [],
    recentlyActiveTasks: [],
  };
}

export default function TodayPage({
  currentUser,
  activeWorkspace,
  focusTasks,
  dailyFocusStats,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
  onQuickCreateTask,
}: TodayPageProps) {
  const [todayData, setTodayData] = useState<TodayPageData>(getEmptyTodayData);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchTodayPageData({
      currentUser,
      workspaceId: activeWorkspace?.id || null,
    })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setTodayData(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load Today data.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id, currentUser]);

  const hasUrgentTasks = todayData.overdueTasks.length > 0 || todayData.dueTodayTasks.length > 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff,transparent_34%),#F8F9FA] px-5 py-7 sm:px-7">
      <section className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-blue-600">
              Today
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
              My Day
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pick the few tasks that matter today, then start a focused work session without opening the full board.
            </p>
          </div>

          <button
            type="button"
            onClick={onQuickCreateTask}
            className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,0.26)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            Quick add task
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <AppleCard className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Today</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {dailyFocusStats.completedSessions} sessions
            </p>
            <p className="mt-1 text-sm text-slate-500">{dailyFocusStats.focusedMinutes} focused minutes</p>
          </AppleCard>
          <AppleCard className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Interruptions</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {dailyFocusStats.interruptedSessions}
            </p>
            <p className="mt-1 text-sm text-slate-500">sessions stopped after 60s</p>
          </AppleCard>
          <AppleCard className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Top focus</p>
            <p className="mt-2 truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
              {dailyFocusStats.topTaskTitle || 'No focus sessions yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">Pick one task and start a session.</p>
          </AppleCard>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Loading today planning data...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <AppleCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">
                      Daily Focus Plan
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose up to 3 tasks. This reuses the existing Focus Dock.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {focusTasks.length}/3
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {focusTasks.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                      No urgent tasks. Choose one task to focus on.
                    </div>
                  ) : (
                    focusTasks.map((focusTask) => {
                      const taskSummary: TodayTaskSummary = {
                        id: focusTask.id,
                        boardId: focusTask.boardId,
                        boardTitle: focusTask.boardTitle,
                        listId: focusTask.listId || '',
                        listTitle: focusTask.listTitle || 'Untitled list',
                        title: focusTask.title,
                        description: '',
                        priority: focusTask.priority || null,
                        dueDate: focusTask.dueDate || null,
                        assigneeAvatar: focusTask.assigneeAvatar,
                        isDone: Boolean(focusTask.isDone),
                        updatedAt: null,
                      };

                      return (
                        <TodayTaskCard
                          key={focusTask.id}
                          task={taskSummary}
                          isFocusTask
                          onOpenTask={onOpenTask}
                          onStartFocus={onStartFocus}
                          onToggleTodayFocus={onToggleTodayFocus}
                        />
                      );
                    })
                  )}
                </div>
              </AppleCard>

              {!hasUrgentTasks && (
                <motion.div
                  className="rounded-[2rem] border border-sky-100 bg-sky-50/70 p-5 text-slate-700 shadow-sm"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                >
                  <h2 className="text-sm font-semibold text-slate-950">No urgent tasks today.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this as planning space: choose one meaningful task, start focus, and keep the board out of the way.
                  </p>
                </motion.div>
              )}
            </div>

            <div className="space-y-6">
              <TodayTaskSection
                title="Overdue"
                description="Clear these first if they still matter."
                tasks={todayData.overdueTasks}
                emptyMessage="No overdue tasks."
                isFocusTask={isFocusTask}
                onOpenTask={onOpenTask}
                onStartFocus={onStartFocus}
                onToggleTodayFocus={onToggleTodayFocus}
              />

              <TodayTaskSection
                title="Due today"
                description="Deadline-driven work for this day."
                tasks={todayData.dueTodayTasks}
                emptyMessage="No urgent tasks. Choose one task to focus on."
                isFocusTask={isFocusTask}
                onOpenTask={onOpenTask}
                onStartFocus={onStartFocus}
                onToggleTodayFocus={onToggleTodayFocus}
              />

              <TodayTaskSection
                title="Assigned to me"
                description="Your workload, sorted by due date."
                tasks={todayData.assignedTasks}
                emptyMessage="No assigned tasks in this workspace."
                isFocusTask={isFocusTask}
                onOpenTask={onOpenTask}
                onStartFocus={onStartFocus}
                onToggleTodayFocus={onToggleTodayFocus}
              />

              <TodayTaskSection
                title="Recently active"
                description="Tasks updated recently in this workspace."
                tasks={todayData.recentlyActiveTasks}
                emptyMessage="No recent task activity yet."
                isFocusTask={isFocusTask}
                onOpenTask={onOpenTask}
                onStartFocus={onStartFocus}
                onToggleTodayFocus={onToggleTodayFocus}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
