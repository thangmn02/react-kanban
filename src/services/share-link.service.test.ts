import sql from '../../supabase/migrations/20261111100000_board_share_links.sql?raw';
import { expect, it } from 'vitest';
import { createShareToken, fetchSharedBoard, hashShareToken, parseSharedBoard, shareFeedUrl, shareUrl } from './share-link.service';

it('makes long unguessable tokens that are safe in a URL and never repeat', () => {
  const tokens = new Set(Array.from({ length: 50 }, createShareToken));
  expect(tokens.size).toBe(50);
  for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

it('hashes a token with SHA-256, matching what the database computes', async () => {
  expect(await hashShareToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

it('builds the public address from the token', () => {
  expect(shareUrl('tok', 'https://example.test')).toBe('https://example.test/share/tok');
  expect(shareFeedUrl('tok', 'ics', 'https://example.test')).toBe('https://example.test/api/share-feed?format=ics&token=tok');
});

it('keeps only the fields the public page shows', () => {
  const board = parseSharedBoard({
    board: { title: 'Launch', description: 'secret', id: 'b1' }, lists: ['To do', 5, 'Done'],
    tasks: [
      { title: 'Ship', list: 'Done', priority: 'High', dueDate: '2026-11-20', isDone: true, updatedAt: '2026-11-11T08:00:00Z', assignees: ['Linh', '', 4], description: 'secret', id: 't1' },
      { title: 'Plan' }, { list: 'no title' }, null,
    ],
  });
  expect(board).toEqual({ title: 'Launch', lists: ['To do', 'Done'], tasks: [
    { title: 'Ship', list: 'Done', priority: 'High', dueDate: '2026-11-20', isDone: true, updatedAt: '2026-11-11T08:00:00Z', assignees: ['Linh'] },
    { title: 'Plan', list: '', priority: null, dueDate: null, isDone: false, updatedAt: null, assignees: [] },
  ] });
  expect(JSON.stringify(board)).not.toContain('secret');
});

it('treats anything that is not a board as no board', () => {
  for (const value of [null, undefined, 'x', [], {}, { board: {} }, { board: { title: 3 } }]) expect(parseSharedBoard(value)).toBeNull();
});

it('does not ask the backend about a malformed token', async () => {
  expect(await fetchSharedBoard('short')).toBeNull();
  expect(await fetchSharedBoard('has spaces and symbols !!! ................................')).toBeNull();
});

it('keeps the migration inside its boundary', () => {
  const code = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  // anon gets the one function and nothing on the table.
  expect(code).toMatch(/revoke all on table public\.board_share_links from public, anon, authenticated;/);
  expect(code).not.toMatch(/grant[^;]*on table public\.board_share_links to[^;]*anon/);
  expect(code).toMatch(/enable row level security/);
  expect(code).toMatch(/grant execute on function public\.get_shared_board\(text\) to anon, authenticated;/);
  expect(code).toMatch(/security definer set search_path = ''/);
  // Every policy is for managers.
  expect(code.match(/create policy/g)).toHaveLength(3);
  expect(code.match(/app_private\.can_manage_workspace_members\(workspace_id\)/g)!.length).toBeGreaterThanOrEqual(4);
  // The public function reads no private task or board field, and only live links.
  const fn = code.slice(code.indexOf('create or replace function public.get_shared_board'));
  for (const field of ['description', 'image', 'attachments', 'email', 'avatar', 'created_by', 'category', 't.id\'', 'b.id\'']) expect(fn).not.toContain(`'${field}`);
  expect(fn).not.toMatch(/t\.description|b\.description|t\.image|profiles|auth\.users/);
  expect(fn).toMatch(/s\.revoked_at is null/);
  expect(fn).toMatch(/b\.archived_at is null/);
  expect(fn).toMatch(/t\.deleted_at is null and t\.archived_at is null/);
});
