-- Harden public Kanban data access and remove RPC exposure for internal
-- SECURITY DEFINER helpers. This migration intentionally scopes policy rewrites
-- to workspace-owned app data and dependent policies that call those helpers.

create schema if not exists app_private;

grant usage on schema app_private to authenticated;

create or replace function app_private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function app_private.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function app_private.can_manage_workspace_members(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

revoke all on function app_private.is_workspace_member(uuid) from public, anon;
revoke all on function app_private.can_edit_workspace(uuid) from public, anon;
revoke all on function app_private.can_manage_workspace_members(uuid) from public, anon;
grant execute on function app_private.is_workspace_member(uuid) to authenticated;
grant execute on function app_private.can_edit_workspace(uuid) to authenticated;
grant execute on function app_private.can_manage_workspace_members(uuid) to authenticated;

create or replace function public.set_list_workspace_id()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_workspace_id uuid;
begin
  select board_row.workspace_id
  into parent_workspace_id
  from public.boards board_row
  where board_row.id = new.board_id;

  if parent_workspace_id is null then
    raise exception 'List must belong to a board with a workspace.';
  end if;

  new.workspace_id := parent_workspace_id;
  return new;
end;
$$;

create or replace function public.set_task_workspace_id()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_workspace_id uuid;
begin
  select board_row.workspace_id
  into parent_workspace_id
  from public.lists list_row
  join public.boards board_row
    on board_row.id = list_row.board_id
  where list_row.id = new.list_id
    and board_row.id = new.board_id;

  if parent_workspace_id is null then
    raise exception 'Task must belong to a list and board in a workspace.';
  end if;

  new.workspace_id := parent_workspace_id;

  if new.is_done = true and new.completed_at is null then
    new.completed_at := now();
  elsif new.is_done = false then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.set_task_activity_workspace_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select task_row.workspace_id, task_row.board_id
  into new.workspace_id, new.board_id
  from public.tasks task_row
  where task_row.id = new.task_id;

  if new.workspace_id is null or new.board_id is null then
    raise exception 'Task activity must belong to a task in a workspace.';
  end if;

  return new;
end;
$$;

create or replace function public.set_task_child_workspace_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select task_row.workspace_id
  into new.workspace_id
  from public.tasks task_row
  where task_row.id = new.task_id;

  if new.workspace_id is null then
    raise exception 'Task child row must belong to a task in a workspace.';
  end if;

  return new;
end;
$$;

create or replace function public.set_task_label_workspace_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select board_row.workspace_id
  into new.workspace_id
  from public.boards board_row
  where board_row.id = new.board_id;

  if new.workspace_id is null then
    raise exception 'Task label must belong to a board in a workspace.';
  end if;

  return new;
end;
$$;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.handle_new_user()',
    'public.handle_new_workspace_owner()',
    'public.rls_auto_enable()',
    'public.is_workspace_member(uuid)',
    'public.can_edit_workspace(uuid)',
    'public.can_manage_workspace_members(uuid)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is not null then
      execute format('revoke all on function %s from public, anon, authenticated', function_oid);
    end if;
  end loop;

  foreach function_signature in array array[
    'public.create_workspace_with_owner(text)',
    'public.invite_workspace_member_by_email(uuid, text, text)',
    'public.accept_workspace_invite(text)',
    'public.add_workspace_member_by_email(uuid, text, text)',
    'public.update_task_positions(jsonb)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is not null then
      execute format('revoke all on function %s from public, anon', function_oid);
      execute format('grant execute on function %s to authenticated', function_oid);
    end if;
  end loop;

  function_oid := to_regprocedure('public.set_updated_at()');
  if function_oid is not null then
    execute format('alter function %s set search_path = public', function_oid);
  end if;
end $$;

alter table public.boards enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activities enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'boards',
        'lists',
        'tasks',
        'task_activities',
        'task_checklist_items',
        'task_labels',
        'task_label_links'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

create policy "Workspace members can read boards"
on public.boards
for select
using (app_private.is_workspace_member(workspace_id));

create policy "Workspace editors can insert boards"
on public.boards
for insert
with check (app_private.can_edit_workspace(workspace_id));

create policy "Workspace editors can update boards"
on public.boards
for update
using (app_private.can_edit_workspace(workspace_id))
with check (app_private.can_edit_workspace(workspace_id));

create policy "Workspace editors can delete boards"
on public.boards
for delete
using (app_private.can_edit_workspace(workspace_id));

create policy "Workspace members can read lists"
on public.lists
for select
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = lists.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert lists"
on public.lists
for insert
with check (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = lists.board_id
      and lists.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update lists"
on public.lists
for update
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = lists.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = lists.board_id
      and lists.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete lists"
on public.lists
for delete
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = lists.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace members can read tasks"
on public.tasks
for select
using (
  exists (
    select 1
    from public.lists list_row
    join public.boards board_row
      on board_row.id = list_row.board_id
    where list_row.id = tasks.list_id
      and board_row.id = tasks.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert tasks"
on public.tasks
for insert
with check (
  exists (
    select 1
    from public.lists list_row
    join public.boards board_row
      on board_row.id = list_row.board_id
    where list_row.id = tasks.list_id
      and board_row.id = tasks.board_id
      and tasks.workspace_id is not distinct from board_row.workspace_id
      and list_row.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update tasks"
on public.tasks
for update
using (
  exists (
    select 1
    from public.lists list_row
    join public.boards board_row
      on board_row.id = list_row.board_id
    where list_row.id = tasks.list_id
      and board_row.id = tasks.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.lists list_row
    join public.boards board_row
      on board_row.id = list_row.board_id
    where list_row.id = tasks.list_id
      and board_row.id = tasks.board_id
      and tasks.workspace_id is not distinct from board_row.workspace_id
      and list_row.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete tasks"
on public.tasks
for delete
using (
  exists (
    select 1
    from public.lists list_row
    join public.boards board_row
      on board_row.id = list_row.board_id
    where list_row.id = tasks.list_id
      and board_row.id = tasks.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace members can read task activities"
on public.task_activities
for select
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_activities.task_id
      and board_row.id = task_row.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert task activities"
on public.task_activities
for insert
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_activities.task_id
      and board_row.id = task_row.board_id
      and task_activities.workspace_id is not distinct from board_row.workspace_id
      and task_activities.board_id is not distinct from board_row.id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update task activities"
on public.task_activities
for update
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_activities.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_activities.task_id
      and board_row.id = task_row.board_id
      and task_activities.workspace_id is not distinct from board_row.workspace_id
      and task_activities.board_id is not distinct from board_row.id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete task activities"
on public.task_activities
for delete
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_activities.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace members can read checklist items"
on public.task_checklist_items
for select
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_checklist_items.task_id
      and board_row.id = task_row.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert checklist items"
on public.task_checklist_items
for insert
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_checklist_items.task_id
      and board_row.id = task_row.board_id
      and task_checklist_items.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update checklist items"
on public.task_checklist_items
for update
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_checklist_items.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_checklist_items.task_id
      and board_row.id = task_row.board_id
      and task_checklist_items.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete checklist items"
on public.task_checklist_items
for delete
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    where task_row.id = task_checklist_items.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace members can read task labels"
on public.task_labels
for select
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = task_labels.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert task labels"
on public.task_labels
for insert
with check (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = task_labels.board_id
      and task_labels.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update task labels"
on public.task_labels
for update
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = task_labels.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = task_labels.board_id
      and task_labels.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete task labels"
on public.task_labels
for delete
using (
  exists (
    select 1
    from public.boards board_row
    where board_row.id = task_labels.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace members can read task label links"
on public.task_label_links
for select
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    join public.task_labels label_row
      on label_row.id = task_label_links.label_id
     and label_row.board_id = board_row.id
    where task_row.id = task_label_links.task_id
      and board_row.id = task_row.board_id
      and app_private.is_workspace_member(board_row.workspace_id)
  )
);

create policy "Workspace editors can insert task label links"
on public.task_label_links
for insert
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    join public.task_labels label_row
      on label_row.id = task_label_links.label_id
     and label_row.board_id = board_row.id
    where task_row.id = task_label_links.task_id
      and board_row.id = task_row.board_id
      and task_label_links.workspace_id is not distinct from board_row.workspace_id
      and label_row.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can update task label links"
on public.task_label_links
for update
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    join public.task_labels label_row
      on label_row.id = task_label_links.label_id
     and label_row.board_id = board_row.id
    where task_row.id = task_label_links.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    join public.task_labels label_row
      on label_row.id = task_label_links.label_id
     and label_row.board_id = board_row.id
    where task_row.id = task_label_links.task_id
      and board_row.id = task_row.board_id
      and task_label_links.workspace_id is not distinct from board_row.workspace_id
      and label_row.workspace_id is not distinct from board_row.workspace_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

create policy "Workspace editors can delete task label links"
on public.task_label_links
for delete
using (
  exists (
    select 1
    from public.tasks task_row
    join public.lists list_row
      on list_row.id = task_row.list_id
    join public.boards board_row
      on board_row.id = list_row.board_id
    join public.task_labels label_row
      on label_row.id = task_label_links.label_id
     and label_row.board_id = board_row.id
    where task_row.id = task_label_links.task_id
      and board_row.id = task_row.board_id
      and app_private.can_edit_workspace(board_row.workspace_id)
  )
);

drop policy if exists "Workspace members can read workspaces" on public.workspaces;
create policy "Workspace members can read workspaces"
on public.workspaces
for select
using (app_private.is_workspace_member(id));

drop policy if exists "Workspace editors can update workspaces" on public.workspaces;
create policy "Workspace editors can update workspaces"
on public.workspaces
for update
using (app_private.can_edit_workspace(id))
with check (app_private.can_edit_workspace(id));

drop policy if exists "Workspace members can read their memberships" on public.workspace_members;
create policy "Workspace members can read their memberships"
on public.workspace_members
for select
using (
  user_id = auth.uid()
  or app_private.is_workspace_member(workspace_id)
);

drop policy if exists "Workspace editors can manage memberships" on public.workspace_members;
drop policy if exists "Workspace managers can insert memberships" on public.workspace_members;
create policy "Workspace managers can insert memberships"
on public.workspace_members
for insert
with check (
  app_private.can_manage_workspace_members(workspace_id)
  and role in ('admin', 'member', 'viewer')
);

drop policy if exists "Workspace managers can update memberships" on public.workspace_members;
create policy "Workspace managers can update memberships"
on public.workspace_members
for update
using (
  app_private.can_manage_workspace_members(workspace_id)
  and role <> 'owner'
)
with check (
  app_private.can_manage_workspace_members(workspace_id)
  and role in ('admin', 'member', 'viewer')
);

drop policy if exists "Workspace managers can delete memberships" on public.workspace_members;
create policy "Workspace managers can delete memberships"
on public.workspace_members
for delete
using (
  app_private.can_manage_workspace_members(workspace_id)
  and role <> 'owner'
);

drop policy if exists "Workspace members can read peer profiles" on public.profiles;
create policy "Workspace members can read peer profiles"
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members viewer_membership
    join public.workspace_members peer_membership
      on peer_membership.workspace_id = viewer_membership.workspace_id
    where viewer_membership.user_id = auth.uid()
      and peer_membership.user_id = profiles.id
      and app_private.is_workspace_member(viewer_membership.workspace_id)
  )
);

drop policy if exists "Workspace managers can read invites" on public.workspace_invites;
create policy "Workspace managers can read invites"
on public.workspace_invites
for select
using (app_private.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can create invites" on public.workspace_invites;
create policy "Workspace managers can create invites"
on public.workspace_invites
for insert
with check (app_private.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can update invites" on public.workspace_invites;
create policy "Workspace managers can update invites"
on public.workspace_invites
for update
using (app_private.can_manage_workspace_members(workspace_id))
with check (app_private.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can delete invites" on public.workspace_invites;
create policy "Workspace managers can delete invites"
on public.workspace_invites
for delete
using (app_private.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace members can read task covers" on storage.objects;
create policy "Workspace members can read task covers"
on storage.objects
for select
using (
  bucket_id = 'task-covers'
  and app_private.is_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can upload task covers" on storage.objects;
create policy "Workspace editors can upload task covers"
on storage.objects
for insert
with check (
  bucket_id = 'task-covers'
  and app_private.can_edit_workspace((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can update task covers" on storage.objects;
create policy "Workspace editors can update task covers"
on storage.objects
for update
using (
  bucket_id = 'task-covers'
  and app_private.can_edit_workspace((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'task-covers'
  and app_private.can_edit_workspace((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can delete task covers" on storage.objects;
create policy "Workspace editors can delete task covers"
on storage.objects
for delete
using (
  bucket_id = 'task-covers'
  and app_private.can_edit_workspace((storage.foldername(name))[1]::uuid)
);
