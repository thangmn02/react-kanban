import { format, isBefore, isToday, parseISO, startOfToday } from 'date-fns';

import type { BoardData, BoardTaskItem } from '../types/task.type';

export interface TaskReportAssigneeStat {
  name: string;
  avatar?: string;
  total: number;
  done: number;
  overdue: number;
}

export interface TaskReport {
  boardTitle: string;
  generatedAt: string;
  total: number;
  done: number;
  remaining: number;
  overdue: number;
  unassigned: number;
  byAssignee: TaskReportAssigneeStat[];
}

export interface ReportLabels {
  boardTitle: string;
  generatedAt: string;
  total: string;
  done: string;
  remaining: string;
  overdue: string;
  unassigned: string;
  byAssignee: string;
  assignee: string;
  noAssignee: string;
  summary: string;
}

// Optional heuristic: list titles whose kanban column represents active/in-progress
// work. Matched case-insensitively as a substring so "In Progress", "WIP", "Doing"
// all qualify. NOT surfaced in the report — the data model has no per-task status
// field beyond isDone, so a list-title guess is too ambiguous as a headline metric.
// Exported for callers that want to estimate active work themselves.
const IN_PROGRESS_LIST_KEYWORDS = ['progress', 'in progress', 'in-progress', 'doing', 'wip'];

export function isListTitleInProgress(listTitle: string | undefined): boolean {
  if (!listTitle) {
    return false;
  }

  const normalized = listTitle.trim().toLowerCase();
  return IN_PROGRESS_LIST_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isTaskOverdue(task: { dueDate?: string; isDone?: boolean }): boolean {
  if (!task.dueDate || task.isDone) {
    return false;
  }

  const dueDate = parseISO(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return isBefore(dueDate, startOfToday()) && !isToday(dueDate);
}

interface BuildTaskReportParams {
  boardTitle: string;
  boardData: BoardData;
  now?: Date;
}

/**
 * Builds an in-memory progress report from the currently loaded board data.
 * Pure / synchronous: no Supabase access, no side effects. "Done" follows the
 * task `isDone` flag (single source of truth); "Remaining" = Total − Done. The
 * data model has no per-task status field beyond isDone, so active/in-progress
 * work is NOT reported as a headline metric — see `isListTitleInProgress` for an
 * optional list-title heuristic if a caller wants to estimate it themselves.
 */
export function buildTaskReport({
  boardTitle,
  boardData,
  now = new Date(),
}: BuildTaskReportParams): TaskReport {
  const tasks = Object.values(boardData.task).filter((task): task is BoardTaskItem => Boolean(task));

  const total = tasks.length;
  const done = tasks.filter((task) => task.isDone).length;
  const remaining = total - done;
  const overdue = tasks.filter((task) => isTaskOverdue(task)).length;
  const unassigned = tasks.filter((task) => task.assignees.length === 0).length;

  const statsByName = new Map<string, TaskReportAssigneeStat>();
  tasks.forEach((task) => {
    if (task.assignees.length === 0) {
      return;
    }

    const isOverdue = isTaskOverdue(task);
    task.assignees.forEach((assignee) => {
      const existing = statsByName.get(assignee.name);
      if (existing) {
        existing.total += 1;
        if (task.isDone) {
          existing.done += 1;
        }
        if (isOverdue) {
          existing.overdue += 1;
        }
      } else {
        statsByName.set(assignee.name, {
          name: assignee.name,
          avatar: assignee.avatar,
          total: 1,
          done: task.isDone ? 1 : 0,
          overdue: isOverdue ? 1 : 0,
        });
      }
    });
  });

  const byAssignee = Array.from(statsByName.values()).sort((current, next) => (
    next.total - current.total || current.name.localeCompare(next.name)
  ));

  return {
    boardTitle,
    generatedAt: now.toISOString(),
    total,
    done,
    remaining,
    overdue,
    unassigned,
    byAssignee,
  };
}

const DEFAULT_LABELS: ReportLabels = {
  boardTitle: 'Board',
  generatedAt: 'Generated',
  total: 'Total tasks',
  done: 'Done',
  remaining: 'Remaining',
  overdue: 'Overdue',
  unassigned: 'Unassigned',
  byAssignee: 'Tasks by assignee',
  assignee: 'Assignee',
  noAssignee: 'No assigned tasks',
  summary: 'Progress report',
};

export function reportToMarkdown(report: TaskReport, labels: ReportLabels = DEFAULT_LABELS): string {
  const generatedLabel = format(parseISO(report.generatedAt), 'yyyy-MM-dd HH:mm');
  const lines: string[] = [
    `### ${labels.summary}: ${report.boardTitle}`,
    '',
    `_${labels.generatedAt}: ${generatedLabel}_`,
    '',
    `| ${labels.total} | ${labels.done} | ${labels.remaining} | ${labels.overdue} | ${labels.unassigned} |`,
    '| ---: | ---: | ---: | ---: | ---: |',
    `| ${report.total} | ${report.done} | ${report.remaining} | ${report.overdue} | ${report.unassigned} |`,
    '',
    `#### ${labels.byAssignee}`,
    '',
  ];

  if (report.byAssignee.length === 0) {
    lines.push(`_${labels.noAssignee}_`, '');
  } else {
    lines.push(
      `| ${labels.assignee} | ${labels.total} | ${labels.done} | ${labels.overdue} |`,
      '| --- | ---: | ---: | ---: |',
    );
    report.byAssignee.forEach((stat) => {
      lines.push(`| ${stat.name} | ${stat.total} | ${stat.done} | ${stat.overdue} |`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function reportToPlainText(report: TaskReport, labels: ReportLabels = DEFAULT_LABELS): string {
  const generatedLabel = format(parseISO(report.generatedAt), 'yyyy-MM-dd HH:mm');
  const lines: string[] = [
    `${labels.summary}: ${report.boardTitle}`,
    `${labels.generatedAt}: ${generatedLabel}`,
    '',
    `${labels.total}: ${report.total}`,
    `${labels.done}: ${report.done}`,
    `${labels.remaining}: ${report.remaining}`,
    `${labels.overdue}: ${report.overdue}`,
    `${labels.unassigned}: ${report.unassigned}`,
    '',
    `${labels.byAssignee}:`,
  ];

  if (report.byAssignee.length === 0) {
    lines.push(`- ${labels.noAssignee}`);
  } else {
    report.byAssignee.forEach((stat) => {
      lines.push(`- ${stat.name}: ${stat.total} total, ${stat.done} done, ${stat.overdue} overdue`);
    });
  }

  return lines.join('\n');
}