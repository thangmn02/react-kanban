-- Read-only share links for a board.
--
-- A workspace owner or admin creates a link; anyone holding it can read a fixed, narrow view of that one board
-- without signing in. The link can be revoked. Additive: one new table and one new function, no existing row or
-- policy changes. Apply only after backing up the target database.
--
-- Boundary:
--   * Only the SHA-256 of the token is stored, so a database read does not reveal working links.
--   * The table is reachable by workspace managers only (RLS). anon has no table access at all.
--   * anon reads through public.get_shared_board alone. It is SECURITY DEFINER with an empty search_path and
--     returns: board title, list titles, and per task its title, list, priority, due date, done flag, update time
--     and assignee display names. It never returns descriptions, comments, attachments, images, notes, emails,
--     avatars, user ids or any other board.

create table if not exists public.board_share_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists board_share_links_board_idx on public.board_share_links (board_id) where revoked_at is null;

alter table public.board_share_links enable row level security;

revoke all on table public.board_share_links from public, anon, authenticated;
grant select, insert on table public.board_share_links to authenticated;
-- Revoking is the only change a link can ever receive.
grant update (revoked_at) on table public.board_share_links to authenticated;

drop policy if exists "Workspace managers can read share links" on public.board_share_links;
create policy "Workspace managers can read share links" on public.board_share_links
  for select to authenticated using (app_private.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can create share links" on public.board_share_links;
create policy "Workspace managers can create share links" on public.board_share_links
  for insert to authenticated with check (
    app_private.can_manage_workspace_members(workspace_id)
    and created_by = auth.uid()
    and revoked_at is null
    -- The link must name a live board of that same workspace.
    -- Columns of the new row are named in full: inside the subquery a bare workspace_id would mean b.workspace_id.
    and exists (select 1 from public.boards b where b.id = board_share_links.board_id
      and b.workspace_id = board_share_links.workspace_id and b.archived_at is null)
  );

drop policy if exists "Workspace managers can revoke share links" on public.board_share_links;
create policy "Workspace managers can revoke share links" on public.board_share_links
  for update to authenticated
  using (app_private.can_manage_workspace_members(workspace_id))
  with check (app_private.can_manage_workspace_members(workspace_id) and revoked_at is not null);

create or replace function public.get_shared_board(share_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'board', jsonb_build_object('title', b.title),
    'lists', coalesce((
      select jsonb_agg(l.title order by l.position, l.id)
      from public.lists l where l.board_id = b.id and l.archived_at is null), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', t.title,
        'list', l.title,
        'priority', t.priority,
        'dueDate', t.due_date,
        'isDone', t.is_done,
        'updatedAt', t.updated_at,
        'assignees', coalesce((
          select jsonb_agg(a.value->>'name')
          from jsonb_array_elements(case when jsonb_typeof(t.assignees) = 'array' then t.assignees else '[]'::jsonb end) a
          where nullif(a.value->>'name', '') is not null), '[]'::jsonb)
      ) order by l.position, l.id, t.position, t.id)
      from public.tasks t
      join public.lists l on l.id = t.list_id and l.board_id = b.id and l.archived_at is null
      where t.board_id = b.id and t.deleted_at is null and t.archived_at is null), '[]'::jsonb)
  )
  from public.board_share_links s
  join public.boards b on b.id = s.board_id and b.workspace_id = s.workspace_id
  where share_token ~ '^[A-Za-z0-9_-]{40,128}$'
    and s.token_hash = encode(sha256(convert_to(share_token, 'UTF8')), 'hex')
    and s.revoked_at is null
    and b.archived_at is null;
$$;

alter function public.get_shared_board(text) owner to postgres;
revoke all on function public.get_shared_board(text) from public;
grant execute on function public.get_shared_board(text) to anon, authenticated;
