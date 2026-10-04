import { expect, it } from 'vitest';
import { dataErrorMessage, isMissingDatabaseField, isMissingDatabaseTable } from './dataError';

it('keeps useful plain Supabase errors instead of hiding them behind generic failed messages', () => {
  expect(dataErrorMessage({ message: 'Permission denied' }, 'Unable to add task')).toBe('Permission denied');
  expect(dataErrorMessage(new Error('Unavailable'), 'Failed')).toBe('Unavailable');
  expect(dataErrorMessage(null, 'Failed')).toBe('Failed');
});
it('does not mistake RLS, foreign-key or network errors for missing optional tables', () => {
  for (const code of ['42501', '23503', '']) {
    expect(isMissingDatabaseTable({ code, message: 'task_checklist_items failed' }, ['task_checklist_items'])).toBe(false);
  }
  expect(isMissingDatabaseTable({ code: '42P01', message: 'relation task_labels does not exist' }, ['task_labels'])).toBe(true);
  expect(isMissingDatabaseField({ code: 'PGRST204', message: 'repeat_interval missing' }, 'repeat_interval')).toBe(true);
});
