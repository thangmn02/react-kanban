-- Additive Notes storage. Review hosted authorization and verify recovery before
-- applying. Content, explicit resource grants and per-user layout are separate.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null default '' check (length(title) <= 160),
  content jsonb not null default '{"html":"","checklist":[]}'::jsonb,
  content_schema_version integer not null default 1 check (content_schema_version = 1),
  visibility text not null default 'private' check (visibility in ('private','workspace')),
  revision bigint not null default 1 check (revision > 0),
  write_token uuid not null default gen_random_uuid(),
  import_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (workspace_id is not null or visibility = 'private'),
  check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 262144),
  unique (owner_user_id, import_key)
);
create index notes_workspace_updated on public.notes(workspace_id, updated_at desc);
create table public.note_access (
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('view','comment','edit')),
  created_at timestamptz not null default now(),
  primary key(note_id,user_id)
);
create table public.note_user_presentation (
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  presentation jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(note_id,user_id),
  check (jsonb_typeof(presentation) = 'object' and octet_length(presentation::text) <= 4096)
);
create table public.note_task_links (
  note_id uuid not null references public.notes(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(note_id,task_id)
);
create table public.note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index note_comments_resource_created on public.note_comments(note_id,created_at);

create function app_private.valid_note_document(document jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(document)='object' and jsonb_typeof(document->'html')='string'
    and length(document->>'html')<=60000 and octet_length(document::text)<=262144
    and case when jsonb_typeof(document->'checklist')='array' then
      jsonb_array_length(document->'checklist')<=100 and not exists(
        select 1 from jsonb_array_elements(document->'checklist') item
        where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 100
          or jsonb_typeof(item->'text') is distinct from 'string' or length(item->>'text')>500
          or jsonb_typeof(item->'isDone') is distinct from 'boolean')
      else false end,false);
$$;
alter table public.notes add constraint notes_document_valid check(app_private.valid_note_document(content));

create function app_private.note_permission(target_note_id uuid, resource_action text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select
    auth.uid() is not null and resource_action in ('view','comment','edit','manage')
    and (n.workspace_id is null or app_private.is_workspace_member(n.workspace_id))
    and (n.deleted_at is null or resource_action = 'manage')
    and (
      n.owner_user_id = auth.uid()
      or coalesce((select case a.permission when 'view' then 1 when 'comment' then 2 when 'edit' then 3 else 0 end
        from public.note_access a where a.note_id = n.id and a.user_id = auth.uid()),0)
        >= case resource_action when 'view' then 1 when 'comment' then 2 when 'edit' then 3 when 'manage' then 4 else 999 end
      or (n.visibility = 'workspace' and n.deleted_at is null and
        case resource_action when 'view' then app_private.is_workspace_member(n.workspace_id)
          when 'comment' then app_private.can_edit_workspace(n.workspace_id)
          when 'edit' then app_private.can_edit_workspace(n.workspace_id) else false end)
    ) from public.notes n where n.id = target_note_id),false);
$$;
revoke all on function app_private.note_permission(uuid,text) from public,anon;
grant execute on function app_private.note_permission(uuid,text) to authenticated;

alter table public.notes enable row level security;
alter table public.note_access enable row level security;
alter table public.note_user_presentation enable row level security;
alter table public.note_task_links enable row level security;
alter table public.note_comments enable row level security;
create policy notes_read on public.notes for select to authenticated
using (app_private.note_permission(id,'view') or app_private.note_permission(id,'manage'));
create policy note_access_read on public.note_access for select to authenticated
using (app_private.note_permission(note_id,'manage') or (user_id = auth.uid() and app_private.note_permission(note_id,'view')));
create policy note_presentation_read on public.note_user_presentation for select to authenticated
using (user_id = auth.uid() and app_private.note_permission(note_id,'view'));
create policy note_links_read on public.note_task_links for select to authenticated
using (app_private.note_permission(note_id,'view') and app_private.is_workspace_member(workspace_id)
  and exists(select 1 from public.tasks t where t.id = task_id and t.workspace_id = note_task_links.workspace_id and t.deleted_at is null and t.archived_at is null));
create policy note_comments_read on public.note_comments for select to authenticated
using (app_private.note_permission(note_id,'view'));
grant select on public.notes,public.note_access,public.note_user_presentation,public.note_task_links,public.note_comments to authenticated;
revoke insert,update,delete on public.notes,public.note_access,public.note_user_presentation,public.note_task_links,public.note_comments from authenticated,anon;
grant all on public.notes,public.note_access,public.note_user_presentation,public.note_task_links,public.note_comments to service_role;

create function public.save_note(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
<<note_write>>
declare
  note_id uuid := (request->>'id')::uuid;
  workspace_id uuid := (request->>'workspaceId')::uuid;
  expected_revision bigint := (request->>'expectedRevision')::bigint;
  token uuid := (request->>'writeToken')::uuid;
  note_row public.notes;
  linked_task public.tasks;
  import_key text := nullif(request->>'importKey','');
  title text := coalesce(request->>'title','');
  content jsonb := request->'content';
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  if auth.uid() is null then raise exception 'Sign in to save Notes.' using errcode='42501'; end if;
  if note_id is null or token is null or expected_revision is null then raise exception 'A note identity, revision and write token are required.'; end if;
  if length(title)>160 or not app_private.valid_note_document(content) then raise exception 'Note content is invalid or too large.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(note_id::text,0));
  select * into note_row from public.notes n where n.id=note_id for update;
  if not found then
    if expected_revision<>0 then raise exception 'Note changed or is unavailable.' using errcode='PT409'; end if;
    perform 1 from public.workspace_members m where m.workspace_id=note_write.workspace_id and m.user_id=auth.uid() for share;
    if workspace_id is not null and not app_private.can_edit_workspace(workspace_id) then raise exception 'Workspace edit permission is required to create a note.' using errcode='42501'; end if;
    if import_key is not null then
      perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||import_key,0));
      select * into note_row from public.notes n where n.owner_user_id=auth.uid() and n.import_key=note_write.import_key;
      if found then
        if note_row.workspace_id is distinct from workspace_id then raise exception 'This device note was imported to another destination. Its remote content was not changed.' using errcode='PT409'; end if;
        if not app_private.note_permission(note_row.id,'view') or note_row.deleted_at is not null then raise exception 'The imported note is unavailable. Restore it from Trash or check workspace access.' using errcode='42501'; end if;
        return to_jsonb(note_row);
      end if;
    end if;
    insert into public.notes(id,owner_user_id,workspace_id,title,content,write_token,import_key)
      values(note_id,auth.uid(),workspace_id,title,content,token,import_key) returning * into note_row;
  else
    perform 1 from public.workspace_members m where m.workspace_id=note_row.workspace_id and m.user_id=auth.uid() for share;
    if not app_private.note_permission(note_id,'edit') then raise exception 'You no longer have permission to edit this note.' using errcode='42501'; end if;
    if note_row.workspace_id is distinct from workspace_id then raise exception 'A note cannot move between workspaces during save.'; end if;
    if note_row.write_token=token then return to_jsonb(note_row); end if;
    if note_row.revision<>expected_revision then raise exception 'This note changed in another session. Your draft has been retained.' using errcode='PT409'; end if;
    update public.notes n set title=note_write.title,content=note_write.content,revision=n.revision+1,write_token=token,updated_at=clock_timestamp()
      where n.id=note_id returning * into note_row;
  end if;
  if request ? 'taskId' then
    if nullif(request->>'taskId','') is not null then
      select t.* into linked_task from public.tasks t
        join public.lists l on l.id=t.list_id and l.board_id=t.board_id
        join public.boards b on b.id=t.board_id and b.workspace_id=t.workspace_id and b.workspace_id=l.workspace_id
        where t.id=(request->>'taskId')::uuid and t.deleted_at is null and t.archived_at is null and l.archived_at is null and b.archived_at is null for share of t,l,b;
      perform 1 from public.workspace_members m where m.workspace_id=linked_task.workspace_id and m.user_id=auth.uid() for share;
      if linked_task.id is null or not app_private.is_workspace_member(linked_task.workspace_id)
        or (note_row.workspace_id is not null and note_row.workspace_id<>linked_task.workspace_id) then raise exception 'The linked task is not available in this note workspace.' using errcode='42501'; end if;
    end if;
    delete from public.note_task_links l where l.note_id=note_write.note_id;
    if linked_task.id is not null then insert into public.note_task_links(note_id,task_id,workspace_id) values(note_id,linked_task.id,linked_task.workspace_id); end if;
  end if;
  return to_jsonb(note_row);
end;
$$;

create function public.set_note_access(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
<<note_share>>
declare
  note_id uuid := (request->>'id')::uuid; note_row public.notes;
  target_user uuid := (request->>'userId')::uuid;
  permission text := request->>'permission'; visibility text := request->>'visibility';
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  select * into note_row from public.notes n where n.id=note_id for update;
  perform 1 from public.workspace_members m where m.workspace_id=note_row.workspace_id and m.user_id in (auth.uid(),target_user) order by m.user_id for share;
  if note_row.id is null or not app_private.note_permission(note_id,'manage') or note_row.deleted_at is not null then raise exception 'Note management permission is required.' using errcode='42501'; end if;
  if note_row.revision is distinct from (request->>'expectedRevision')::bigint then raise exception 'Note permissions changed. Refresh before sharing.' using errcode='PT409'; end if;
  if request ? 'visibility' then
    if visibility not in ('private','workspace') or visibility is null or (visibility='workspace' and note_row.workspace_id is null) then raise exception 'Invalid note visibility.'; end if;
    update public.notes n set visibility=note_share.visibility where n.id=note_id;
  end if;
  if target_user is not null then
    if target_user=note_row.owner_user_id then raise exception 'The owner already manages this note.'; end if;
    if note_row.workspace_id is null or not exists(select 1 from public.workspace_members m where m.workspace_id=note_row.workspace_id and m.user_id=target_user) then raise exception 'Share only with a current member of this note workspace.' using errcode='42501'; end if;
    if permission is null then delete from public.note_access a where a.note_id=note_share.note_id and a.user_id=target_user;
    elsif permission in ('view','comment','edit') then
      insert into public.note_access(note_id,user_id,permission) values(note_id,target_user,permission)
        on conflict(note_id,user_id) do update set permission=excluded.permission;
    else raise exception 'Invalid note permission.'; end if;
  end if;
  update public.notes n set revision=n.revision+1,write_token=gen_random_uuid(),updated_at=clock_timestamp() where n.id=note_id returning * into note_row;
  return to_jsonb(note_row);
end;
$$;

create function public.set_note_deleted(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare note_row public.notes; note_id uuid := (request->>'id')::uuid; remove boolean := (request->>'deleted')::boolean;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  select * into note_row from public.notes n where n.id=note_id for update;
  perform 1 from public.workspace_members m where m.workspace_id=note_row.workspace_id and m.user_id=auth.uid() for share;
  if note_row.id is null or not app_private.note_permission(note_id,'manage') then raise exception 'Note management permission is required.' using errcode='42501'; end if;
  if note_row.revision is distinct from (request->>'expectedRevision')::bigint or remove is null then raise exception 'Note changed. Refresh before deleting or restoring.' using errcode='PT409'; end if;
  update public.notes n set deleted_at=case when remove then clock_timestamp() else null end,revision=n.revision+1,write_token=gen_random_uuid(),updated_at=clock_timestamp() where n.id=note_id returning * into note_row;
  return to_jsonb(note_row);
end;
$$;

create function public.save_note_presentation(request jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare note_id uuid := (request->>'id')::uuid; layout jsonb := request->'presentation';
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  perform 1 from public.notes n where n.id=note_id for share;
  perform 1 from public.workspace_members m join public.notes n on n.workspace_id=m.workspace_id
    where n.id=note_id and m.user_id=auth.uid() for share of m;
  if not app_private.note_permission(note_id,'view') then raise exception 'Note access is no longer available.' using errcode='42501'; end if;
  if jsonb_typeof(layout) is distinct from 'object' or octet_length(layout::text)>4096 then raise exception 'Invalid note layout.'; end if;
  if coalesce((request->>'onlyIfAbsent')::boolean,false) then
    insert into public.note_user_presentation(note_id,user_id,presentation) values(note_id,auth.uid(),layout) on conflict(note_id,user_id) do nothing;
  else
    insert into public.note_user_presentation(note_id,user_id,presentation) values(note_id,auth.uid(),layout)
      on conflict(note_id,user_id) do update set presentation=excluded.presentation,updated_at=clock_timestamp();
  end if;
end;
$$;

create function public.mutate_note_comment(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
<<note_comment>>
declare note_id uuid := (request->>'noteId')::uuid; comment_id uuid := (request->>'id')::uuid;
  comment_row public.note_comments; action text := request->>'action'; body text := trim(request->>'body');
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  -- Lock the note so permission changes and comment writes have one order.
  perform 1 from public.notes n where n.id=note_id for share;
  perform 1 from public.workspace_members m join public.notes n on n.workspace_id=m.workspace_id
    where n.id=note_id and m.user_id=auth.uid() for share of m;
  if not app_private.note_permission(note_id,'comment') then raise exception 'Comment permission is required.' using errcode='42501'; end if;
  if action='create' then
    if body is null or length(body) not between 1 and 4000 then raise exception 'Use a comment between 1 and 4000 characters.'; end if;
    insert into public.note_comments(id,note_id,author_user_id,body) values(comment_id,note_id,auth.uid(),body)
      on conflict(id) do nothing;
    select * into comment_row from public.note_comments c where c.id=comment_id;
    if comment_row.note_id<>note_id or comment_row.author_user_id<>auth.uid() then raise exception 'Comment identity is unavailable.' using errcode='42501'; end if;
  else
    select * into comment_row from public.note_comments c where c.id=comment_id and c.note_id=note_comment.note_id for update;
    if not found or (comment_row.author_user_id<>auth.uid() and not app_private.note_permission(note_id,'manage')) then raise exception 'Only the author or a note manager may change this comment.' using errcode='42501'; end if;
    if comment_row.revision is distinct from (request->>'expectedRevision')::bigint then raise exception 'The comment changed. Reload it before editing.' using errcode='PT409'; end if;
    if action='delete' then delete from public.note_comments c where c.id=comment_id; return null;
    elsif action='edit' then
      update public.note_comments c set body=note_comment.body,revision=c.revision+1,updated_at=clock_timestamp() where c.id=comment_id returning * into comment_row;
    else raise exception 'Invalid comment action.'; end if;
  end if;
  return to_jsonb(comment_row);
end;
$$;

revoke all on function public.save_note(jsonb),public.set_note_access(jsonb),public.set_note_deleted(jsonb),public.save_note_presentation(jsonb),public.mutate_note_comment(jsonb) from public,anon;
grant execute on function public.save_note(jsonb),public.set_note_access(jsonb),public.set_note_deleted(jsonb),public.save_note_presentation(jsonb),public.mutate_note_comment(jsonb) to authenticated;

-- Rejoining a workspace must not silently revive an old explicit resource grant.
create function app_private.retire_removed_member_note_access() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.workspace_id is not distinct from new.workspace_id and old.user_id is not distinct from new.user_id then return new; end if;
  delete from public.note_access a using public.notes n
    where a.note_id=n.id and n.workspace_id=old.workspace_id and a.user_id=old.user_id;
  delete from public.note_user_presentation p using public.notes n
    where p.note_id=n.id and n.workspace_id=old.workspace_id and p.user_id=old.user_id;
  return old;
end;
$$;
revoke all on function app_private.retire_removed_member_note_access() from public,anon,authenticated;
create trigger retire_removed_member_note_access after delete or update of workspace_id,user_id on public.workspace_members
for each row execute function app_private.retire_removed_member_note_access();
do $$
declare table_name text;
begin
  foreach table_name in array array['notes','note_access','note_comments','note_task_links'] loop
    if not exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end
$$;
