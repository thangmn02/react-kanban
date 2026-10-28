-- Originals, references and presentation have separate identities and permissions.
create table public.task_comments (
  id uuid primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check(length(trim(body)) between 1 and 4000),
  revision bigint not null default 1 check(revision>0),
  write_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index task_comments_task_created on public.task_comments(task_id,created_at);
create table public.saved_context (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check(resource_type in ('task','task_comment','note','note_comment')),
  resource_id uuid not null,
  saved_at timestamptz not null default now(),
  primary key(user_id,resource_type,resource_id)
);
create table public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  revision bigint not null,
  title text not null,
  content jsonb not null,
  write_token uuid not null,
  saved_at timestamptz not null default now(),
  unique(note_id,revision)
);

create function app_private.task_context(target_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('taskId',t.id,'workspaceId',t.workspace_id,'boardId',t.board_id,'label',t.title)
  from public.tasks t join public.lists l on l.id=t.list_id and l.board_id=t.board_id and l.workspace_id=t.workspace_id
    join public.boards b on b.id=t.board_id and b.workspace_id=t.workspace_id
  where t.id=target_id and t.deleted_at is null and t.archived_at is null and l.archived_at is null and b.archived_at is null
    and app_private.is_workspace_member(t.workspace_id);
$$;
revoke all on function app_private.task_context(uuid) from public,anon;
grant execute on function app_private.task_context(uuid) to authenticated;
alter table public.task_comments enable row level security;
alter table public.saved_context enable row level security;
alter table public.note_revisions enable row level security;
create policy task_comments_read on public.task_comments for select to authenticated
  using(deleted_at is null and app_private.task_context(task_id) is not null);
create policy saved_context_read on public.saved_context for select to authenticated using(user_id=auth.uid());
-- History is private to the original owner, including after sharing a note.
create policy note_revisions_read on public.note_revisions for select to authenticated
  using(exists(select 1 from public.notes n where n.id=note_id and n.owner_user_id=auth.uid() and app_private.note_permission(n.id,'manage')));
grant select on public.task_comments,public.saved_context,public.note_revisions to authenticated;
revoke insert,update,delete on public.task_comments,public.saved_context,public.note_revisions from authenticated,anon;
grant all on public.task_comments,public.saved_context,public.note_revisions to service_role;

create function public.mutate_task_comment(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); target uuid:=(request->>'id')::uuid; task uuid:=(request->>'taskId')::uuid;
  token uuid:=(request->>'writeToken')::uuid; action text:=request->>'action';
  original public.task_comments; parent public.tasks; body text:=trim(coalesce(request->>'body',''));
begin
  if actor is null or actor is distinct from (request->>'actorUserId')::uuid then raise exception 'The signed-in account changed.' using errcode='42501';end if;
  if target is null or token is null or action not in ('create','edit','delete') then raise exception 'A comment identity and operation are required.';end if;
  perform pg_advisory_xact_lock(hashtextextended('task-comment:'||target::text,0));
  select * into parent from public.tasks where id=task for share;
  perform 1 from public.workspace_members m where m.workspace_id=parent.workspace_id and m.user_id=actor for share;
  if parent.id is null or app_private.task_context(task) is null or not app_private.can_edit_workspace(parent.workspace_id) then raise exception 'Task comment permission is unavailable.' using errcode='42501';end if;
  select * into original from public.task_comments where id=target for update;
  if found then
    if original.task_id<>task or (original.author_user_id is distinct from actor and not exists(select 1 from public.workspace_members m where m.workspace_id=parent.workspace_id and m.user_id=actor and m.role in ('owner','admin'))) then raise exception 'Only the comment author or a workspace administrator may change this comment.' using errcode='42501';end if;
    if original.write_token=token then return to_jsonb(original);end if;
    if action='create' or original.deleted_at is not null or original.revision is distinct from (request->>'expectedRevision')::bigint then raise exception 'This comment changed. Reopen its original before editing.' using errcode='PT409';end if;
    if action='edit' and length(body) not between 1 and 4000 then raise exception 'Comments must contain 1–4000 characters.';end if;
    update public.task_comments c set body=case when action='edit' then mutate_task_comment.body else c.body end,
      revision=c.revision+1,write_token=token,updated_at=clock_timestamp(),deleted_at=case when action='delete' then clock_timestamp() else null end
      where c.id=target returning * into original;
  else
    if action<>'create' or coalesce((request->>'expectedRevision')::bigint,0)<>0 then raise exception 'This comment is unavailable.' using errcode='PT409';end if;
    insert into public.task_comments(id,task_id,workspace_id,author_user_id,body,write_token) values(target,task,parent.workspace_id,actor,body,token) returning * into original;
  end if;
  return to_jsonb(original);
end;$$;

create function app_private.saved_resource(kind text,target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare context jsonb; comment record; note public.notes;
begin
  if auth.uid() is null then return null;end if;
  if kind='task' then return app_private.task_context(target);end if;
  if kind='task_comment' then
    select c.* into comment from public.task_comments c where c.id=target and c.deleted_at is null;
    if not found then return null;end if;context:=app_private.task_context(comment.task_id);
    if context is null then return null;end if;
    return context||jsonb_build_object('preview',left(comment.body,300),'commentId',comment.id);
  end if;
  if kind='note_comment' then
    select c.* into comment from public.note_comments c where c.id=target;
    if not found or not app_private.note_permission(comment.note_id,'view') then return null;end if;
    select n.* into note from public.notes n where n.id=comment.note_id and n.deleted_at is null;
    if not found then return null;end if;
    return jsonb_build_object('noteId',note.id,'workspaceId',note.workspace_id,'label',note.title,'preview',left(comment.body,300),'commentId',comment.id);
  end if;
  if kind='note' and app_private.note_permission(target,'view') then
    select n.* into note from public.notes n where n.id=target and n.deleted_at is null;
    if found then return jsonb_build_object('noteId',note.id,'workspaceId',note.workspace_id,'label',note.title);end if;
  end if;
  return null;
end;$$;
revoke all on function app_private.saved_resource(text,uuid) from public,anon,authenticated;

create function app_private.add_saved_reference(actor uuid,kind text,target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('saved-context:'||actor::text,0));
  if exists(select 1 from public.saved_context where user_id=actor and resource_type=kind and resource_id=target) then return;end if;
  if (select count(*) from public.saved_context where user_id=actor)>=500 then raise exception 'Saved Context is full. Remove unused references before saving another.';end if;
  insert into public.saved_context(user_id,resource_type,resource_id) values(actor,kind,target) on conflict do nothing;
end;$$;

create function public.set_saved_context(request jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();kind text:=request->>'resourceType';target uuid:=(request->>'resourceId')::uuid;save boolean:=(request->>'saved')::boolean;
begin
  if actor is null or actor is distinct from (request->>'actorUserId')::uuid then raise exception 'The signed-in account changed.' using errcode='42501';end if;
  if kind not in ('task','task_comment','note','note_comment') or target is null or save is null then raise exception 'A supported original resource is required.';end if;
  perform pg_advisory_xact_lock(hashtextextended('saved-context:'||actor::text,0));
  if save then
    if app_private.saved_resource(kind,target) is null then raise exception 'The original resource is unavailable.' using errcode='42501';end if;
    perform app_private.add_saved_reference(actor,kind,target);
  else delete from public.saved_context where user_id=actor and resource_type=kind and resource_id=target;end if;
  if kind='note' and app_private.note_permission(target,'view') then
    insert into public.note_user_presentation(note_id,user_id,presentation) values(target,actor,jsonb_build_object('pinned',save))
      on conflict(note_id,user_id) do update set presentation=public.note_user_presentation.presentation||excluded.presentation,updated_at=clock_timestamp();
  end if;
end;$$;

create function public.list_saved_context(actor_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('resourceType',s.resource_type,'resourceId',s.resource_id,'savedAt',s.saved_at,'source',app_private.saved_resource(s.resource_type,s.resource_id)) order by s.saved_at desc),'[]'::jsonb)
  from public.saved_context s where s.user_id=auth.uid() and actor_user_id=auth.uid();
$$;
create function app_private.note_bookmark_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.presentation->'pinned'='true'::jsonb then perform app_private.add_saved_reference(new.user_id,'note',new.note_id);
  else delete from public.saved_context where user_id=new.user_id and resource_type='note' and resource_id=new.note_id;end if;return new;
end;$$;
create trigger note_bookmark_reference after insert or update of presentation on public.note_user_presentation for each row execute function app_private.note_bookmark_reference();
-- Preserve every existing bookmark. Accounts already above the new-reference
-- bound can open/remove these grandfathered references but cannot add more.
insert into public.saved_context(user_id,resource_type,resource_id) select user_id,'note',note_id from public.note_user_presentation where presentation->'pinned'='true'::jsonb order by user_id,updated_at,note_id on conflict do nothing;

create function app_private.retain_note_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.title is distinct from new.title or old.content is distinct from new.content then
    insert into public.note_revisions(note_id,revision,title,content,write_token) values(old.id,old.revision,old.title,old.content,old.write_token) on conflict do nothing;
  end if;return new;
end;$$;
create trigger retain_note_revision before update on public.notes for each row execute function app_private.retain_note_revision();
-- Images referenced by recoverable history must remain available for restoration.
create function app_private.protect_revision_image() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.state='ready' and new.state<>'ready' and exists(select 1 from public.note_revisions r where r.note_id=old.note_id and old.id in (select app_private.note_image_references(r.content->>'html'))) then raise exception 'This image is retained by note revision history.' using errcode='PT409';end if;return new;
end;$$;
create trigger protect_revision_image before update on public.note_images for each row execute function app_private.protect_revision_image();

create function public.restore_note_revision(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original public.note_revisions;parent public.notes;
begin
  if auth.uid() is null or auth.uid() is distinct from (request->>'actorUserId')::uuid then raise exception 'The signed-in account changed.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended((request->>'noteId'),0));
  select * into parent from public.notes where id=(request->>'noteId')::uuid for update;
  if parent.owner_user_id is distinct from auth.uid() or parent.deleted_at is not null or not app_private.note_permission(parent.id,'manage') then raise exception 'Note history is unavailable.' using errcode='42501';end if;
  select * into original from public.note_revisions where id=(request->>'revisionId')::uuid and note_id=parent.id;
  if not found then raise exception 'This revision is unavailable.';end if;
  return public.save_note(jsonb_build_object('id',parent.id,'workspaceId',parent.workspace_id,'actorUserId',auth.uid(),'expectedRevision',request->'expectedRevision','writeToken',request->'writeToken','title',original.title,'content',original.content));
end;$$;
create function app_private.notify_task_context_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous uuid;current uuid;recipients uuid[];
begin
  if tg_op<>'INSERT' then previous:=old.workspace_id;end if;
  if tg_op<>'DELETE' then current:=new.workspace_id;end if;
  select array_agg(distinct user_id) into recipients from public.workspace_members where workspace_id in (previous,current);
  perform app_private.send_note_invalidation(coalesce(recipients,array[]::uuid[]));return null;
end;$$;
create trigger notify_task_comment_context after insert or update or delete on public.task_comments for each row execute function app_private.notify_task_context_change();
create trigger notify_task_saved_context after update or delete on public.tasks for each row execute function app_private.notify_task_context_change();
create trigger notify_board_saved_context after update or delete on public.boards for each row execute function app_private.notify_task_context_change();
create trigger notify_list_saved_context after update or delete on public.lists for each row execute function app_private.notify_task_context_change();
create trigger notify_saved_context after insert or delete on public.saved_context for each row execute function app_private.notify_note_presentation_change();

revoke all on function public.mutate_task_comment(jsonb),public.set_saved_context(jsonb),public.list_saved_context(uuid),public.restore_note_revision(jsonb) from public,anon;
grant execute on function public.mutate_task_comment(jsonb),public.set_saved_context(jsonb),public.list_saved_context(uuid),public.restore_note_revision(jsonb) to authenticated;
revoke all on function app_private.note_bookmark_reference(),app_private.retain_note_revision(),app_private.protect_revision_image(),app_private.notify_task_context_change(),app_private.add_saved_reference(uuid,text,uuid) from public,anon,authenticated;
