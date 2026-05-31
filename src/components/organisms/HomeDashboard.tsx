import { useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from 'framer-motion';
import {
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns';

import { VIETNAM_HOLIDAYS_2026 } from '../../data/vietnamHolidays';
import {
  fetchHomeDashboardData,
  type HomeDashboardData,
  type HomeTaskSummary,
} from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import { FOCUS_BUTTON_LABELS } from '../../constants';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import AppleCard from '../atoms/AppleCard';
import DueDateBadge from '../atoms/DueDateBadge';
import MyTasksSummary from '../home/MyTasksSummary';

interface HomeDashboardProps {
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onToggleFocusTask: (task: HomeTaskSummary) => void;
  isFocusTask: (taskId: string) => boolean;
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
}

function getTasksDueThisWeek(tasks: HomeTaskSummary[]) {
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

  return tasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const dueDate = parseISO(task.dueDate);
    return dueDate >= weekStart && dueDate <= weekEnd;
  });
}

function getHolidayCountdownLabel(daysRemaining: number) {
  if (daysRemaining === 0) {
    return 'Hôm nay được nghỉ';
  }

  if (daysRemaining > 0) {
    return 'ngày nữa';
  }

  return 'ngày đã qua';
}

function AnimatedDayCount({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion();
  const counter = useMotionValue(0);
  const spring = useSpring(counter, {
    stiffness: 90,
    damping: 18,
    mass: 0.7,
  });
  const roundedValue = useTransform(spring, (latest) => Math.round(latest));

  useEffect(() => {
    counter.set(Math.abs(value));
  }, [counter, value]);

  if (value === 0) {
    return <span>Today</span>;
  }

  // Reduce Motion: skip the count-up animation and render the final value directly.
  if (prefersReducedMotion) {
    return <span>{Math.abs(value)}</span>;
  }

  return <motion.span>{roundedValue}</motion.span>;
}

const holidayListVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.08,
    },
  },
};

const holidayCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.98,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 170,
      damping: 22,
      mass: 0.8,
    },
  },
};

function HomeDashboard({
  onOpenTask,
  onOpenBoard,
  onToggleFocusTask,
  isFocusTask,
  currentUser,
  activeWorkspace,
}: HomeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<HomeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchHomeDashboardData({
      currentUser,
      workspaceId: activeWorkspace?.id,
    })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setDashboardData(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load dashboard data.');
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

  const myTasks = dashboardData?.myTasks || [];
  const recentBoards = dashboardData?.recentBoards || [];
  const tasksDueThisWeek = getTasksDueThisWeek(myTasks);
  const upcomingHolidays = useMemo(() => {
    const today = new Date();

    return VIETNAM_HOLIDAYS_2026
      .map((holiday) => {
        const holidayDate = parseISO(holiday.date);

        return {
          ...holiday,
          daysRemaining: differenceInCalendarDays(holidayDate, today),
        };
      })
      .sort((currentHoliday, nextHoliday) => {
        const currentIsUpcoming = currentHoliday.daysRemaining >= 0;
        const nextIsUpcoming = nextHoliday.daysRemaining >= 0;

        if (currentIsUpcoming && !nextIsUpcoming) return -1;
        if (!currentIsUpcoming && nextIsUpcoming) return 1;

        return Math.abs(currentHoliday.daysRemaining) - Math.abs(nextHoliday.daysRemaining);
      });
  }, []);
  const holidaysThisWeek = upcomingHolidays.filter((holiday) => {
    const holidayDate = parseISO(holiday.date);
    return isWithinInterval(holidayDate, {
      start: startOfWeek(new Date()),
      end: endOfWeek(new Date()),
    });
  });
  const holidaySummary = holidaysThisWeek.length > 0
    ? `Tuần này có ${holidaysThisWeek.length} ngày nghỉ lễ`
    : tasksDueThisWeek.length >= 5
      ? 'Tuần này workload cao'
      : `${tasksDueThisWeek.length} task đến hạn tuần này`;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/70 bg-white/80 px-4 py-5 backdrop-blur-xl lg:block">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">Kanban</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Workspace</h2>
        </div>

        <nav className="space-y-2">
          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm">
            Home
          </div>
        </nav>

        <div className="mt-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Recent boards
          </p>
          <div className="space-y-2">
            {recentBoards.slice(0, 4).map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => onOpenBoard(board.id)}
                className="w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-slate-100/80 hover:text-gray-900"
              >
                {board.title}
              </button>
            ))}
            {!isLoading && recentBoards.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No boards yet.</p>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">Home</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Personal dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {currentUser.name}'s assigned tasks, recent boards, and due-date rhythm.
            </p>
          </div>

          <AppleCard className="flex items-center gap-3 px-3 py-2" interactive>
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="h-9 w-9 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
              <p className="text-xs text-gray-500">{activeWorkspace?.name || 'Current workspace'}</p>
            </div>
          </AppleCard>
        </div>

        {isLoading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            Loading dashboard data...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <AppleCard>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-600">My Tasks</h2>
                  <p className="mt-1 text-sm text-gray-500">{myTasks.length} assigned tasks sorted by due date</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Due first
                </span>
              </div>

              <MyTasksSummary tasks={myTasks} />

              <div className="divide-y divide-gray-100/80">
                {myTasks.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-gray-400">No assigned tasks found.</div>
                ) : (
                  myTasks.map((task) => {
                    const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

                    const isFocused = isFocusTask(task.id);

                    return (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTask(task.id, task.boardId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenTask(task.id, task.boardId);
                          }
                        }}
                        className="grid w-full gap-3 px-5 py-4 text-left transition-[background,transform] duration-200 hover:bg-slate-50/90 active:scale-[0.995] md:grid-cols-[minmax(0,1fr)_auto_auto_auto] focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{task.title}</p>
                          <p className="mt-1 truncate text-xs text-gray-500">{task.boardTitle}</p>
                        </div>

                        <div className="flex items-center">
                          {task.priority && priorityClassName ? (
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
                              {task.priority}
                            </span>
                          ) : (
                            <span className="rounded-full border border-dashed border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-400">
                              No priority
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-start md:justify-end">
                          <DueDateBadge dueDate={task.dueDate || undefined} />
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFocusTask(task);
                          }}
                          className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                            isFocused
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-pressed={isFocused}
                          aria-label={`${isFocused ? 'Remove from' : 'Add to'} Focus Dock: ${task.title}`}
                        >
                          {isFocused ? FOCUS_BUTTON_LABELS.ACTIVE : FOCUS_BUTTON_LABELS.INACTIVE}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </AppleCard>

            <div className="space-y-6">
              <AppleCard>
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-600">Recent Boards</h2>
                    <p className="mt-1 text-sm text-gray-500">Boards ordered by recent activity</p>
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                  {recentBoards.map((board) => (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => onOpenBoard(board.id)}
                      className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-left shadow-sm transition-[background,border,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{board.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{board.description || 'No description'}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                          {board.taskCount} tasks
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {board.memberAvatars.length === 0 ? (
                            <span className="text-xs text-gray-400">No members</span>
                          ) : (
                            board.memberAvatars.map((avatar) => (
                              <img
                                key={avatar}
                                src={avatar}
                                alt=""
                                className="h-7 w-7 rounded-full border-2 border-white object-cover"
                              />
                            ))
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {board.updatedAt ? format(parseISO(board.updatedAt), 'MMM d') : 'No activity'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </AppleCard>

              <motion.section
                className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92)_42%,_rgba(239,246,255,0.78))] shadow-[0_24px_80px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.05 }}
              >
                <div className="relative overflow-hidden px-6 py-6">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-sky-200/35 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-rose-200/35 blur-3xl" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        Lazy Calendar
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                        Upcoming Holidays
                      </h2>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                        A softer countdown view for planning deadlines around the next real breaks.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
                      {holidaySummary}
                    </div>
                  </div>
                </div>

                <motion.div
                  className="relative space-y-3 px-4 pb-5"
                  variants={holidayListVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {upcomingHolidays.slice(0, 6).map((holiday, index) => {
                    const isUpcoming = holiday.daysRemaining >= 0;

                    return (
                      <motion.button
                        key={holiday.id}
                        type="button"
                        className={`group w-full rounded-[1.5rem] border bg-white/78 p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.07)] backdrop-blur-xl transition-colors ${
                          index === 0 && isUpcoming
                            ? 'border-sky-200/80 ring-1 ring-sky-200/70'
                            : 'border-white/80'
                        } ${!isUpcoming ? 'opacity-70' : ''}`}
                        variants={holidayCardVariants}
                        whileHover={{
                          scale: 1.02,
                          y: -3,
                          boxShadow: '0 22px 60px rgba(15, 23, 42, 0.13)',
                        }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                      >
                        <div className="flex items-center gap-4">
                          <motion.div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-slate-50 to-sky-100 text-2xl shadow-inner ring-1 ring-white/80"
                            whileHover={{ scale: 1.12, rotate: 2 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                          >
                            {holiday.icon}
                          </motion.div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-950">
                                {holiday.name}
                              </h3>
                              <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                                {holiday.vibe}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-400">
                              {format(parseISO(holiday.date), 'dd/MM/yyyy')}
                            </p>
                          </div>

                          <div className="min-w-[96px] text-right">
                            <div className={`text-3xl font-semibold tracking-[-0.05em] ${isUpcoming ? 'text-slate-950' : 'text-slate-300'}`}>
                              <AnimatedDayCount value={holiday.daysRemaining} />
                            </div>
                            <p className={`mt-1 text-[11px] font-semibold ${isUpcoming ? 'text-sky-600' : 'text-slate-400'}`}>
                              {getHolidayCountdownLabel(holiday.daysRemaining)}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}

                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-white/80 bg-white/65 px-4 py-3 shadow-sm backdrop-blur-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">This week</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{tasksDueThisWeek.length} tasks due</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-white/80 bg-white/65 px-4 py-3 shadow-sm backdrop-blur-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-500">Holiday signal</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{holidaySummary}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default HomeDashboard;
