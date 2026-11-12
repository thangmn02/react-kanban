-- "Waiting on" follows the person across devices. Each mark is private to the user who set it: other members of the
-- workspace never see who someone is waiting on. Rows go away with their task. Clients read and write only through
-- the two functions below; until this migration is applied, clients keep marks on the device and upload them later.
-- Adds one table and two functions; no existing rows change. Apply only after backing up the target database.
create table public.task_follow_ups (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  who text not null default '' check(length(who)<=80),
  follow_up_on date not null,
  set_at timestamptz not null default now(),
  primary key(user_id,task_id)
);
create index task_follow_ups_user_workspace on public.task_follow_ups(user_id,workspace_id);
alter table public.task_follow_ups enable row level security;
create policy task_follow_ups_read on public.task_follow_ups for select to authenticated using(user_id=auth.uid());
grant select on public.task_follow_ups to authenticated;
revoke insert,update,delete on public.task_follow_ups from authenticated,anon;
grant all on public.task_follow_ups to service_role;

-- Marks on tasks the person can still open in this workspace.
create function public.list_task_follow_ups(target_workspace_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('taskId',f.task_id,'who',f.who,'followUpOn',f.follow_up_on,'setAt',f.set_at) order by f.set_at desc),'[]'::jsonb)
  from public.task_follow_ups f
  where f.user_id=auth.uid() and f.workspace_id=target_workspace_id and app_private.task_context(f.task_id) is not null;
$$;

-- request: {actorUserId, taskId, who, followUpOn}; followUpOn null clears the mark. A mark set earlier than the stored
-- one (setAt) does not replace it, so a device catching up after being offline cannot undo a newer change.
-- P0002 (task gone or no longer shared) and 54000 (too many marks) tell clients to drop the change, not retry it.
create function public.set_task_follow_up(request jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); task uuid:=(request->>'taskId')::uuid; day date:=(request->>'followUpOn')::date;
  stamp timestamptz:=least(coalesce((request->>'setAt')::timestamptz,clock_timestamp()),clock_timestamp());
  workspace uuid;
begin
  if actor is null or actor is distinct from (request->>'actorUserId')::uuid then raise exception 'The signed-in account changed.' using errcode='42501';end if;
  if task is null then raise exception 'A task is required.';end if;
  if day is null then
    delete from public.task_follow_ups f where f.user_id=actor and f.task_id=task and f.set_at<=stamp;
    return;
  end if;
  workspace:=(app_private.task_context(task)->>'workspaceId')::uuid;
  if workspace is null then raise exception 'The task is unavailable.' using errcode='P0002';end if;
  perform pg_advisory_xact_lock(hashtextextended('task-follow-ups:'||actor::text,0));
  if not exists(select 1 from public.task_follow_ups f where f.user_id=actor and f.task_id=task)
    and (select count(*) from public.task_follow_ups f where f.user_id=actor)>=500 then
    raise exception 'Too many waiting tasks. Stop waiting on some first.' using errcode='54000';
  end if;
  insert into public.task_follow_ups(user_id,task_id,workspace_id,who,follow_up_on,set_at)
    values(actor,task,workspace,left(trim(coalesce(request->>'who','')),80),day,stamp)
    on conflict(user_id,task_id) do update set who=excluded.who,follow_up_on=excluded.follow_up_on,set_at=excluded.set_at,workspace_id=excluded.workspace_id
    where public.task_follow_ups.set_at<=excluded.set_at;
end;$$;

revoke all on function public.list_task_follow_ups(uuid) from public,anon;
revoke all on function public.set_task_follow_up(jsonb) from public,anon;
grant execute on function public.list_task_follow_ups(uuid) to authenticated;
grant execute on function public.set_task_follow_up(jsonb) to authenticated;
