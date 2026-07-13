import type {
  TaskAssignee,
  TaskAttachment,
  TaskChecklistItem,
  TaskLabelColor,
} from '../types/task.type';

export const TASK_LABEL_COLOR_OPTIONS: TaskLabelColor[] = [
  'slate',
  'sky',
  'emerald',
  'amber',
  'rose',
  'violet',
];

const TASK_LABEL_CLASS_MAP: Record<TaskLabelColor, string> = {
  slate: 'bg-slate-100 text-slate-700 border border-slate-200',
  sky: 'bg-sky-100 text-sky-700 border border-sky-200',
  emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  amber: 'bg-amber-100 text-amber-700 border border-amber-200',
  rose: 'bg-rose-100 text-rose-700 border border-rose-200',
  violet: 'bg-violet-100 text-violet-700 border border-violet-200',
};

export function normalizeTaskLabelColor(color: unknown): TaskLabelColor {
  return TASK_LABEL_COLOR_OPTIONS.includes(color as TaskLabelColor)
    ? color as TaskLabelColor
    : 'sky';
}

export function getTaskLabelClass(color: TaskLabelColor) {
  return TASK_LABEL_CLASS_MAP[normalizeTaskLabelColor(color)] || TASK_LABEL_CLASS_MAP.sky;
}

export function stripTaskHtml(html: string) {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const descriptionDocument = new DOMParser().parseFromString(html, 'text/html');
  return descriptionDocument.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

export function getChecklistProgress(checklistItems: TaskChecklistItem[]) {
  const total = checklistItems.length;
  const completed = checklistItems.filter((item) => item.isDone).length;

  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function normalizeTaskAttachments(value: unknown): TaskAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((attachment) => {
    if (
      !attachment
      || typeof attachment !== 'object'
      || typeof (attachment as Record<string, unknown>).id !== 'string'
      || typeof (attachment as Record<string, unknown>).name !== 'string'
      || typeof (attachment as Record<string, unknown>).url !== 'string'
    ) {
      return [];
    }

    return [{
      id: (attachment as Record<string, unknown>).id as string,
      name: (attachment as Record<string, unknown>).name as string,
      url: (attachment as Record<string, unknown>).url as string,
      type: 'link' as const,
    }];
  });
}

export function normalizeTaskAssignees(value: unknown): TaskAssignee[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((assignee) => {
    if (
      !assignee
      || typeof assignee !== 'object'
      || typeof (assignee as Record<string, unknown>).name !== 'string'
      || typeof (assignee as Record<string, unknown>).avatar !== 'string'
    ) {
      return [];
    }

    const record = assignee as Record<string, unknown>;
    return [{
      name: record.name as string,
      avatar: record.avatar as string,
      ...(typeof record.userId === 'string' ? { userId: record.userId } : {}),
      ...(typeof record.workspaceMemberId === 'string' ? { workspaceMemberId: record.workspaceMemberId } : {}),
    }];
  });
}
