export const MAX_STEP_LENGTH = 240;

export function parseTaskSteps(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('steps' in value) || !Array.isArray(value.steps)) {
    throw new Error('invalid_response');
  }
  const steps: unknown[] = value.steps;
  if (steps.length !== 3 || steps.some((step) => typeof step !== 'string' || !step.trim() || step.trim().length > MAX_STEP_LENGTH)) {
    throw new Error('invalid_response');
  }
  const normalized = (steps as string[]).map((step) => step.trim());
  if (new Set(normalized.map((step) => step.toLocaleLowerCase())).size !== 3) throw new Error('invalid_response');
  return normalized;
}
