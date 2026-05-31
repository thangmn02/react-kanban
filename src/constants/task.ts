// Typed tuple via `as const` so members are usable as a union type.
export const TASK_PRIORITIES = ['High', 'Medium', 'Low', 'Lowest'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]; // 'High' | 'Medium' | 'Low' | 'Lowest'

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'Low';

// Object-with-named-members form (Requirement 1.5 requires 'Design' and 'Sprint').
export const DEFAULT_TASK_CATEGORIES = {
  CATEGORY_1: 'Design',
  CATEGORY_2: 'Sprint',
} as const;
