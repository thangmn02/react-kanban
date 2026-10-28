-- Keep the comment input separate from its stored column name.
create or replace function public.mutate_task_comment(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); target uuid:=(request->>'id')::uuid; task uuid:=(request->>'taskId')::uuid;
  token uuid:=(request->>'writeToken')::uuid; action text:=request->>'action';
  original public.task_comments; parent public.tasks; comment_body text:=trim(coalesce(request->>'body',''));
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
    if action='edit' and length(comment_body) not between 1 and 4000 then raise exception 'Comments must contain 1–4000 characters.';end if;
    update public.task_comments c set body=case when action='edit' then comment_body else c.body end,
      revision=c.revision+1,write_token=token,updated_at=clock_timestamp(),deleted_at=case when action='delete' then clock_timestamp() else null end
      where c.id=target returning * into original;
  else
    if action<>'create' or coalesce((request->>'expectedRevision')::bigint,0)<>0 then raise exception 'This comment is unavailable.' using errcode='PT409';end if;
    insert into public.task_comments(id,task_id,workspace_id,author_user_id,body,write_token) values(target,task,parent.workspace_id,actor,comment_body,token) returning * into original;
  end if;
  return to_jsonb(original);
end;$$;
