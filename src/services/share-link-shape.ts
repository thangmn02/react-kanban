export interface SharedTask { title: string; list: string; priority: string | null; dueDate: string | null; isDone: boolean; updatedAt: string | null; assignees: string[] }
export interface SharedBoard { title: string; lists: string[]; tasks: SharedTask[] }

const text = (value: unknown) => typeof value === 'string' ? value : '';

/** Never trusts the shape of what comes back: this page is shown to people outside the workspace. */
export function parseSharedBoard(value: unknown): SharedBoard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as { board?: { title?: unknown }; lists?: unknown; tasks?: unknown };
  if (!raw.board || typeof raw.board.title !== 'string') return null;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  return {
    title: raw.board.title,
    lists: Array.isArray(raw.lists) ? raw.lists.filter((item): item is string => typeof item === 'string') : [],
    tasks: tasks.filter(item => item && typeof item === 'object' && typeof (item as SharedTask).title === 'string').map(item => {
      const task = item as Record<string, unknown>;
      return { title: text(task.title), list: text(task.list), priority: text(task.priority) || null, dueDate: text(task.dueDate) || null,
        isDone: task.isDone === true, updatedAt: text(task.updatedAt) || null,
        assignees: Array.isArray(task.assignees) ? task.assignees.filter((name): name is string => typeof name === 'string' && name.length > 0) : [] };
    }),
  };
}
