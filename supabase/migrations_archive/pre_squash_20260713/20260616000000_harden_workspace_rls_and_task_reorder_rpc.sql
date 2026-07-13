-- Phase 0 production hardening.
--
-- This migration makes the core workspace data tables explicitly RLS-scoped
-- and moves task drag reordering behind one transactional RPC.

create extension if not exists pgcrypto;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_id_idx
on public.workspace_invites (workspace_id);

create index if not exists workspace_invites_email_idx
on public.workspace_invites (lower(email));

create index if not exists workspace_invites_token_idx
on public.workspace_invites (token);

create unique index if not exists workspace_invites_pending_email_idx
on public.workspace_invites (workspace_id, lower(email))
where accepted_at is null;

create or replace function public.can_manage_workspace_members(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

grant execute on function public.can_manage_workspace_members(uuid) to authenticated;

alter table public.boards enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;
alter table public.workspace_invites enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('boards', 'lists', 'tasks', 'workspace_invites')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end $$;

create policy "Workspace members can read boards"
on public.boards
for select
using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can insert boards"
on public.boards
for insert
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update boards"
on public.boards
for update
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete boards"
on public.boards
for delete
using (public.can_edit_workspace(workspace_id));

create policy "Workspace members can read lists"
on public.lists
for select
using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can insert lists"
on public.lists
for insert
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update lists"
on public.lists
for update
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete lists"
on public.lists
for delete
using (public.can_edit_workspace(workspace_id));

create policy "Workspace members can read tasks"
on public.tasks
for select
using (public.is_workspace_member(workspace_id));

create policy "Workspace editors can insert tasks"
on public.tasks
for insert
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can update tasks"
on public.tasks
for update
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete tasks"
on public.tasks
for delete
using (public.can_edit_workspace(workspace_id));

create policy "Workspace managers can read invites"
on public.workspace_invites
for select
using (public.can_manage_workspace_members(workspace_id));

create policy "Invited users can read their invite"
on public.workspace_invites
for select
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Workspace managers can create invites"
on public.workspace_invites
for insert
with check (public.can_manage_workspace_members(workspace_id));

create policy "Workspace managers can update invites"
on public.workspace_invites
for update
using (public.can_manage_workspace_members(workspace_id))
with check (public.can_manage_workspace_members(workspace_id));

create policy "Workspace managers can delete invites"
on public.workspace_invites
for delete
using (public.can_manage_workspace_members(workspace_id));

create or replace function public.update_task_positions(task_positions jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  input_count integer;
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to reorder tasks.';
  end if;

  if task_positions is null or jsonb_typeof(task_positions) <> 'array' then
    raise exception 'Task positions payload must be an array.';
  end if;

  drop table if exists pg_temp.task_position_updates;

  create temporary table task_position_updates (
    id uuid not null,
    list_id uuid not null,
    position integer not null
  ) on commit drop;

  insert into task_position_updates (id, list_id, position)
  select payload.id, payload.list_id, payload.position
  from jsonb_to_recordset(task_positions) as payload(
    id uuid,
    list_id uuid,
    position integer
  );

  select count(*) into input_count
  from task_position_updates;

  if input_count = 0 then
    return;
  end if;

  if exists (
    select 1
    from task_position_updates
    group by id
    having count(*) > 1
  ) then
    raise exception 'Task positions payload contains duplicate task ids.';
  end if;

  if exists (
    select 1
    from task_position_updates update_row
    left join public.tasks task_row
      on task_row.id = update_row.id
    left join public.lists list_row
      on list_row.id = update_row.list_id
    where task_row.id is null
      or list_row.id is null
      or list_row.board_id <> task_row.board_id
      or list_row.workspace_id is distinct from task_row.workspace_id
      or not public.can_edit_workspace(task_row.workspace_id)
  ) then
    raise exception 'Task positions payload contains inaccessible or invalid task moves.';
  end if;

  update public.tasks task_row
  set
    list_id = update_row.list_id,
    position = update_row.position,
    updated_at = now()
  from task_position_updates update_row
  where task_row.id = update_row.id;

  get diagnostics updated_count = row_count;

  if updated_count <> input_count then
    raise exception 'Task reorder only updated % of % tasks.', updated_count, input_count;
  end if;
end;
$$;

revoke all on function public.update_task_positions(jsonb) from public;
grant execute on function public.update_task_positions(jsonb) to authenticated;
