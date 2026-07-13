-- Phase 1 production-readiness foundation.
-- This migration adds workspace ownership/membership primitives and backfills
-- existing demo data into a legacy workspace without breaking the current app.
--
-- RLS lockdown is intentionally transitional here: existing permissive demo
-- policies are left in place until the frontend has Supabase Auth + onboarding.
-- A later migration should remove public policies after workspace-aware queries
-- and authenticated sessions are fully wired.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Nullable during legacy-data migration. Make this NOT NULL after onboarding
  -- can create or claim a workspace for each authenticated user.
  owner_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.boards
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz null;

alter table public.lists
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists archived_at timestamptz null;

alter table public.tasks
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz null;

alter table public.task_activities
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists board_id uuid references public.boards(id) on delete cascade,
  add column if not exists actor_id uuid references auth.users(id) on delete set null;

alter table public.task_checklist_items
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.task_labels
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.task_label_links
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);
create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists boards_workspace_id_idx on public.boards (workspace_id);
create index if not exists boards_created_by_idx on public.boards (created_by);
create index if not exists lists_workspace_id_idx on public.lists (workspace_id);
create index if not exists tasks_workspace_id_idx on public.tasks (workspace_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists task_activities_workspace_id_idx on public.task_activities (workspace_id);
create index if not exists task_activities_board_id_idx on public.task_activities (board_id);
create index if not exists task_activities_actor_id_idx on public.task_activities (actor_id);
create index if not exists task_checklist_items_workspace_id_idx on public.task_checklist_items (workspace_id);
create index if not exists task_labels_workspace_id_idx on public.task_labels (workspace_id);
create index if not exists task_label_links_workspace_id_idx on public.task_label_links (workspace_id);

insert into public.workspaces (id, name, owner_id)
values ('00000000-0000-0000-0000-000000000001', 'Legacy Workspace', null)
on conflict (id) do nothing;

update public.boards
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.lists list_row
set workspace_id = coalesce(board_row.workspace_id, '00000000-0000-0000-0000-000000000001')
from public.boards board_row
where list_row.board_id = board_row.id
  and list_row.workspace_id is null;

update public.tasks task_row
set workspace_id = coalesce(
  (
    select board_row.workspace_id
    from public.boards board_row
    where board_row.id = task_row.board_id
  ),
  (
    select list_row.workspace_id
    from public.lists list_row
    where list_row.id = task_row.list_id
  ),
  '00000000-0000-0000-0000-000000000001'
)
where task_row.workspace_id is null;

update public.task_activities activity_row
set
  workspace_id = task_row.workspace_id,
  board_id = task_row.board_id
from public.tasks task_row
where activity_row.task_id = task_row.id
  and (activity_row.workspace_id is null or activity_row.board_id is null);

update public.task_checklist_items checklist_row
set workspace_id = task_row.workspace_id
from public.tasks task_row
where checklist_row.task_id = task_row.id
  and checklist_row.workspace_id is null;

update public.task_labels label_row
set workspace_id = board_row.workspace_id
from public.boards board_row
where label_row.board_id = board_row.id
  and label_row.workspace_id is null;

update public.task_label_links link_row
set workspace_id = task_row.workspace_id
from public.tasks task_row
where link_row.task_id = task_row.id
  and link_row.workspace_id is null;

create or replace function public.set_board_workspace_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null then
    new.workspace_id := '00000000-0000-0000-0000-000000000001';
  end if;

  return new;
end;
$$;

drop trigger if exists set_board_workspace_id_before_write on public.boards;
create trigger set_board_workspace_id_before_write
before insert or update on public.boards
for each row execute function public.set_board_workspace_id();

create or replace function public.set_list_workspace_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select board_row.workspace_id
    into new.workspace_id
    from public.boards board_row
    where board_row.id = new.board_id;
  end if;

  if new.workspace_id is null then
    new.workspace_id := '00000000-0000-0000-0000-000000000001';
  end if;

  return new;
end;
$$;

drop trigger if exists set_list_workspace_id_before_write on public.lists;
create trigger set_list_workspace_id_before_write
before insert or update on public.lists
for each row execute function public.set_list_workspace_id();

create or replace function public.set_task_workspace_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select board_row.workspace_id
    into new.workspace_id
    from public.boards board_row
    where board_row.id = new.board_id;
  end if;

  if new.workspace_id is null then
    select list_row.workspace_id
    into new.workspace_id
    from public.lists list_row
    where list_row.id = new.list_id;
  end if;

  if new.workspace_id is null then
    new.workspace_id := '00000000-0000-0000-0000-000000000001';
  end if;

  if new.is_done = true and new.completed_at is null then
    new.completed_at := now();
  elsif new.is_done = false then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_workspace_id_before_write on public.tasks;
create trigger set_task_workspace_id_before_write
before insert or update on public.tasks
for each row execute function public.set_task_workspace_id();

create or replace function public.set_task_activity_workspace_context()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null or new.board_id is null then
    select task_row.workspace_id, task_row.board_id
    into new.workspace_id, new.board_id
    from public.tasks task_row
    where task_row.id = new.task_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_activity_workspace_context_before_write on public.task_activities;
create trigger set_task_activity_workspace_context_before_write
before insert or update on public.task_activities
for each row execute function public.set_task_activity_workspace_context();

create or replace function public.set_task_child_workspace_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select task_row.workspace_id
    into new.workspace_id
    from public.tasks task_row
    where task_row.id = new.task_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_checklist_workspace_id_before_write on public.task_checklist_items;
create trigger set_checklist_workspace_id_before_write
before insert or update on public.task_checklist_items
for each row execute function public.set_task_child_workspace_id();

drop trigger if exists set_task_label_link_workspace_id_before_write on public.task_label_links;
create trigger set_task_label_link_workspace_id_before_write
before insert or update on public.task_label_links
for each row execute function public.set_task_child_workspace_id();

create or replace function public.set_task_label_workspace_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select board_row.workspace_id
    into new.workspace_id
    from public.boards board_row
    where board_row.id = new.board_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_label_workspace_id_before_write on public.task_labels;
create trigger set_task_label_workspace_id_before_write
before insert or update on public.task_labels
for each row execute function public.set_task_label_workspace_id();

create or replace function public.is_workspace_member(target_workspace_id uuid)
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
  );
$$;

create or replace function public.can_edit_workspace(target_workspace_id uuid)
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
      and wm.role in ('owner', 'admin', 'member')
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces"
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists "Authenticated users can create owned workspaces" on public.workspaces;
create policy "Authenticated users can create owned workspaces"
on public.workspaces
for insert
with check (owner_id = auth.uid());

drop policy if exists "Workspace editors can update workspaces" on public.workspaces;
create policy "Workspace editors can update workspaces"
on public.workspaces
for update
using (public.can_edit_workspace(id))
with check (public.can_edit_workspace(id));

drop policy if exists "Workspace members can read their memberships" on public.workspace_members;
create policy "Workspace members can read their memberships"
on public.workspace_members
for select
using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can manage memberships" on public.workspace_members;
create policy "Workspace editors can manage memberships"
on public.workspace_members
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

-- Future strict policies. They are additive for now because existing demo
-- policies still allow anon access until Auth is implemented in the app.
drop policy if exists "Workspace members can read boards" on public.boards;
create policy "Workspace members can read boards"
on public.boards
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write boards" on public.boards;
create policy "Workspace editors can write boards"
on public.boards
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read lists" on public.lists;
create policy "Workspace members can read lists"
on public.lists
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write lists" on public.lists;
create policy "Workspace editors can write lists"
on public.lists
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read tasks" on public.tasks;
create policy "Workspace members can read tasks"
on public.tasks
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write tasks" on public.tasks;
create policy "Workspace editors can write tasks"
on public.tasks
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read task activities" on public.task_activities;
create policy "Workspace members can read task activities"
on public.task_activities
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write task activities" on public.task_activities;
create policy "Workspace editors can write task activities"
on public.task_activities
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read checklist items" on public.task_checklist_items;
create policy "Workspace members can read checklist items"
on public.task_checklist_items
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write checklist items" on public.task_checklist_items;
create policy "Workspace editors can write checklist items"
on public.task_checklist_items
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read task labels" on public.task_labels;
create policy "Workspace members can read task labels"
on public.task_labels
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write task labels" on public.task_labels;
create policy "Workspace editors can write task labels"
on public.task_labels
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Workspace members can read task label links" on public.task_label_links;
create policy "Workspace members can read task label links"
on public.task_label_links
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace editors can write task label links" on public.task_label_links;
create policy "Workspace editors can write task label links"
on public.task_label_links
for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));
