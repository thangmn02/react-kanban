export const MAX_STEP_LENGTH = 200;
export const MAX_TASK_TITLE_LENGTH = 200;
export const MAX_TASK_DESCRIPTION_LENGTH = 2000;

export interface TaskBreakdownContext {
  title: string;
  description: string;
  existingSteps: string[];
  labels?: string[];
  dueDate?: string;
  boardTitle?: string;
  columnTitle?: string;
}

function plainText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

/** Bound every field at both the browser and server boundaries. */
export function normalizeBreakdownContext(value: unknown): Required<TaskBreakdownContext> {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    title: plainText(data.title, MAX_TASK_TITLE_LENGTH),
    description: plainText(data.description, MAX_TASK_DESCRIPTION_LENGTH),
    existingSteps: Array.isArray(data.existingSteps) ? data.existingSteps.slice(0, 30).map((step) => plainText(step, MAX_STEP_LENGTH)).filter(Boolean) : [],
    labels: Array.isArray(data.labels) ? data.labels.slice(0, 10).map((label) => plainText(label, 80)).filter(Boolean) : [],
    dueDate: typeof data.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate) ? data.dueDate : '',
    boardTitle: plainText(data.boardTitle, 200),
    columnTitle: plainText(data.columnTitle, 200),
  };
}

export function parseTaskSteps(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('steps' in value) || !Array.isArray(value.steps)) {
    throw new Error('invalid_response');
  }
  const steps: unknown[] = value.steps;
  if (steps.length !== 3 || steps.some((step) => typeof step !== 'string' || !step.trim() || step.length > MAX_STEP_LENGTH || step.includes('```'))) {
    throw new Error('invalid_response');
  }
  const normalized = (steps as string[]).map((step) => step.trim());
  if (new Set(normalized.map((step) => step.toLocaleLowerCase())).size !== 3) throw new Error('invalid_response');
  return normalized;
}
