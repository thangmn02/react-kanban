// @vitest-environment node
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TaskInsert } from '../types/supabase.type';
import { createTask, createTasks, updateTask, RecurrenceSchemaError, AttachmentSchemaError } from './task.service';

const remote = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../lib/supabase', () => ({ default: {}, requireSupabaseClient: () => remote.client }));
const fetcher = vi.fn<typeof fetch>();
const task: TaskInsert = { title: 'Viết kanji', board_id: 'board', list_id: 'list', start_date: '2026-10-04', due_date: '2026-10-05', assignees: [{ id: 'user', name: 'Thang' }], repeat_interval: null };
const row = { ...task, id: 'task' };
const missing = { code: 'PGRST204', message: "Could not find the 'repeat_interval' column of 'tasks' in the schema cache", details: null, hint: null };
const attachment = { id: 'link', name: 'Reference', url: 'https://example.com', type: 'link' };
beforeEach(() => {
  fetcher.mockReset();
  remote.client = createClient('https://example.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher },
  });
});
afterEach(() => vi.restoreAllMocks());
const sentBody = (index = 0) => JSON.parse(String(fetcher.mock.calls[index][1]?.body));

it('creates an ordinary task without the optional recurrence column, preserving dates and assignments', async () => {
  fetcher.mockResolvedValueOnce(Response.json(row));
  expect((await createTask(task)).id).toBe('task');
  expect(sentBody()).not.toHaveProperty('repeat_interval');
  expect(sentBody()).toMatchObject({ title: task.title, due_date: task.due_date, start_date: task.start_date, assignees: task.assignees });
});
it('bulk inserts non-recurring tasks without that column', async () => {
  fetcher.mockResolvedValueOnce(Response.json([row, { ...row, id: 'task2' }]));
  expect(await createTasks([task, { ...task, title: 'Read' }])).toHaveLength(2);
  expect(sentBody().every((item: object) => !('repeat_interval' in item))).toBe(true);
});
it.each(['42703', 'PGRST204'])('retries a null recurrence update only after exact missing-column error %s', async (code) => {
  fetcher.mockResolvedValueOnce(Response.json({ ...missing, code }, { status: 400 })).mockResolvedValueOnce(Response.json(row));
  await updateTask('task', { title: 'New title', repeat_interval: null, due_date: '2026-10-06' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(sentBody()).toHaveProperty('repeat_interval', null);
  expect(sentBody(1)).toEqual({ title: 'New title', due_date: '2026-10-06' });
});
it('still clears recurrence on a migrated database', async () => {
  fetcher.mockResolvedValueOnce(Response.json(row));
  await updateTask('task', { repeat_interval: null });
  expect(sentBody()).toEqual({ repeat_interval: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(['insert', 'bulk', 'update'])('never silently discards a recurrence selection during %s', async (operation) => {
  fetcher.mockResolvedValueOnce(Response.json(missing, { status: 400 }));
  const recurring = { ...task, repeat_interval: 'weekly' };
  const result = operation === 'insert' ? createTask(recurring) : operation === 'bulk' ? createTasks([task, recurring]) : updateTask('task', { repeat_interval: 'weekly' });
  await expect(result).rejects.toBeInstanceOf(RecurrenceSchemaError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  { code: '42501', message: 'new row violates row-level security policy for tasks' },
  { code: '42703', message: 'column tasks.another_field does not exist' },
])('does not retry unrelated errors: $code/$message', async (error) => {
  fetcher.mockResolvedValueOnce(Response.json(error, { status: 400 }));
  await expect(updateTask('task', { repeat_interval: null })).rejects.toMatchObject(error);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('persists non-empty attachment metadata on the migrated schema', async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ...row, attachments: [attachment] }));
  expect(await createTask({ ...task, attachments: [attachment] })).toHaveProperty('attachments', [attachment]);
  expect(sentBody()).toHaveProperty('attachments', [attachment]);
});
it('refuses to silently lose selected attachments on an old schema', async () => {
  fetcher.mockResolvedValueOnce(Response.json({ ...missing, message: "Could not find the 'attachments' column of 'tasks'" }, { status: 400 }));
  await expect(createTask({ ...task, attachments: [attachment] })).rejects.toBeInstanceOf(AttachmentSchemaError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('handles both absent empty optional columns without dropping any normal task edits', async () => {
  fetcher.mockResolvedValueOnce(Response.json(missing, { status: 400 }))
    .mockResolvedValueOnce(Response.json({ ...missing, message: "Could not find the 'attachments' column of 'tasks'" }, { status: 400 }))
    .mockResolvedValueOnce(Response.json(row));
  await updateTask('task', { title: 'Edited', repeat_interval: null, attachments: [] });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(sentBody(2)).toEqual({ title: 'Edited' });
});
it('reads the existing task when clearing absent optional fields leaves no actual update', async () => {
  fetcher.mockResolvedValueOnce(Response.json(missing, { status: 400 })).mockResolvedValueOnce(Response.json(row));
  await updateTask('task', { repeat_interval: null });
  expect(fetcher.mock.calls[1][1]?.method).toBe('GET');
});
