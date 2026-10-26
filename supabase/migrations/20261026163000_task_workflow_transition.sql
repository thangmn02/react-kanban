-- Apply only after backing up the target database. This migration defines an
-- operation on existing tables; it does not repair historical rows or add lists.
create or replace function public.transition_task_workflow(request jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare
  task_row public.tasks; next_row public.tasks; occurrence public.tasks;
  board_id uuid := (request->>'boardId')::uuid;
  task_id uuid := (request->>'taskId')::uuid;
  workspace_id uuid := (request->>'workspaceId')::uuid;
  operation_id uuid := (request->>'operationId')::uuid;
  kind text := request->>'kind'; shape text; mapping text := 'completion-only';
  done_id uuid; active_id uuid; destination uuid; list_ids uuid[];
  source_ids uuid[]; destination_ids uuid[]; ids uuid[]; item uuid;
  source_index integer; target_index integer; i integer;
  completed boolean; changed boolean; newly_completed boolean; completed_time timestamptz;
  history jsonb; recurrence_id text; due_date date; stamp timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not app_private.can_edit_workspace(workspace_id) then
    raise exception 'Workspace edit permission is required.' using errcode='42501';
  end if;
  if kind not in ('complete','reopen','move') or operation_id is null then raise exception 'Invalid workflow request.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(board_id::text,0));
  perform 1 from public.boards b where b.id=board_id and b.workspace_id is not distinct from workspace_id and b.archived_at is null for share;
  if not found then raise exception 'Board is unavailable in this workspace.'; end if;
  select * into task_row from public.tasks t where t.id=task_id and t.board_id=board_id
    and t.workspace_id is not distinct from workspace_id and t.deleted_at is null and t.archived_at is null for update;
  if not found then raise exception 'Task is unavailable in this workspace.'; end if;
  perform 1 from public.lists l where l.board_id=board_id and l.workspace_id is not distinct from workspace_id order by l.id for share;
  select array_agg(l.id order by l.position,l.id), string_agg(regexp_replace(lower(l.title),'[^a-z0-9]','','g'),'/' order by l.position,l.id)
    into list_ids,shape from public.lists l where l.board_id=board_id and l.workspace_id is not distinct from workspace_id and l.archived_at is null;
  if shape in ('todo/doing/done','backlog/inprogress/nearlydone/done') then
    mapping:='standard'; done_id:=list_ids[array_length(list_ids,1)]; active_id:=list_ids[1];
  end if;
  if exists(select 1 from public.task_activities a where a.id=operation_id and a.task_id=task_id) then
    return jsonb_build_object('task',to_jsonb(task_row),'changed',false,'completedTransition',false,'mapping',mapping,'occurrence',null);
  end if;
  if request ? 'expectedListId' and task_row.list_id<>(request->>'expectedListId')::uuid then raise exception 'Task moved elsewhere. Reload and try again.'; end if;
  if request ? 'expectedUpdatedAt' and task_row.updated_at is distinct from (request->>'expectedUpdatedAt')::timestamptz then raise exception 'Task changed elsewhere. Reload and try again.'; end if;
  select a.details into history from public.task_activities a where a.task_id=task_id
    and a.details->>'workflowTransition'='true' and a.details->>'fromCompleted'='false' and a.details->>'toCompleted'='true'
    order by a.created_at desc,a.id desc limit 1;
  destination:=task_row.list_id;
  completed:=case when kind='complete' then true when kind='reopen' then false
    when done_id is not null then (request->>'destinationListId')::uuid=done_id else task_row.is_done end;
  if kind='move' then destination:=(request->>'destinationListId')::uuid;
  elsif done_id is not null and completed then destination:=done_id;
  elsif done_id is not null and task_row.list_id=done_id then
    destination:=case when (history->>'fromListId')::uuid=any(list_ids) and (history->>'fromListId')::uuid<>done_id
      then (history->>'fromListId')::uuid else active_id end;
  end if;
  if destination is null or not(destination=any(list_ids)) then raise exception 'Destination list is unavailable in this board.'; end if;
  select coalesce(array_agg(t.id order by t.position,t.created_at,t.id),'{}'::uuid[]) into source_ids
    from public.tasks t where t.list_id=task_row.list_id and t.deleted_at is null and t.archived_at is null;
  source_index:=array_position(source_ids,task_id)-1;
  select coalesce(array_agg(t.id order by t.position,t.created_at,t.id),'{}'::uuid[]) into destination_ids
    from public.tasks t where t.list_id=destination and t.id<>task_id and t.deleted_at is null and t.archived_at is null;
  target_index:=case when kind='move' then (request->>'destinationIndex')::integer
    when kind='reopen' and destination::text=history->>'fromListId' then (history->>'fromIndex')::integer else null end;
  target_index:=greatest(0,least(cardinality(destination_ids),coalesce(target_index,case when destination=task_row.list_id then source_index else cardinality(destination_ids) end)));
  completed_time:=case when completed then coalesce(task_row.completed_at,stamp) else null end;
  changed:=destination<>task_row.list_id or target_index<>source_index or completed<>task_row.is_done or completed_time is distinct from task_row.completed_at;
  if not changed then return jsonb_build_object('task',to_jsonb(task_row),'changed',false,'completedTransition',false,'mapping',mapping,'occurrence',null); end if;
  update public.tasks t set list_id=destination,is_done=completed,completed_at=completed_time,updated_at=stamp where t.id=task_id returning * into next_row;
  foreach item in array array[task_row.list_id,destination] loop
    if item=destination then ids:=destination_ids[1:target_index]||array[task_id]||destination_ids[target_index+1:cardinality(destination_ids)];
    else ids:=array_remove(source_ids,task_id); end if;
    if cardinality(ids)>0 then for i in 1..cardinality(ids) loop
      update public.tasks t set position=(i-1)*1000,updated_at=stamp where t.id=ids[i] and t.position is distinct from (i-1)*1000;
    end loop; end if;
  end loop;
  newly_completed:=not task_row.is_done and completed;
  select a.details->>'recurrenceId' into recurrence_id from public.task_activities a where a.task_id=task_id and a.details ? 'recurrenceId' limit 1;
  if newly_completed and recurrence_id is null and task_row.due_date is not null and to_jsonb(task_row)->>'repeat_interval' in ('daily','weekly','monthly') then
    due_date:=(task_row.due_date + case to_jsonb(task_row)->>'repeat_interval' when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end)::date;
    select * into occurrence from jsonb_populate_record(null::public.tasks,to_jsonb(task_row)||jsonb_build_object('id',gen_random_uuid(),'list_id',coalesce(active_id,task_row.list_id),
      'position',coalesce((select max(t.position)+1000 from public.tasks t where t.list_id=coalesce(active_id,task_row.list_id) and t.deleted_at is null and t.archived_at is null),0),
      'due_date',due_date,'is_done',false,'completed_at',null,'created_at',stamp,'updated_at',stamp));
    insert into public.tasks select occurrence.*;
  end if;
  select * into next_row from public.tasks t where t.id=task_id;
  insert into public.task_activities(id,task_id,task_title,board_id,workspace_id,actor_id,actor,action,created_at,details)
    values(operation_id,task_id,task_row.title,board_id,workspace_id,auth.uid(),jsonb_build_object('name','You','avatar',''),
      case when task_row.is_done<>completed then 'status_change' else 'move' end,stamp,
      jsonb_build_object('description',case when kind='move' then 'Moved task through workflow' when completed then 'Marked task as completed' else 'Reopened task' end,
        'workflowTransition',true,'fromListId',task_row.list_id,'fromIndex',source_index,'fromPosition',task_row.position,'toListId',destination,'toPosition',next_row.position,
        'fromCompleted',task_row.is_done,'toCompleted',completed)||case when occurrence.id is not null then jsonb_build_object('recurrenceId',occurrence.id) else '{}'::jsonb end);
  return jsonb_build_object('task',to_jsonb(next_row),'changed',true,'completedTransition',newly_completed,'mapping',mapping,'occurrence',case when occurrence.id is not null then to_jsonb(occurrence) else null end);
end;
$$;
revoke all on function public.transition_task_workflow(jsonb) from public,anon;
grant execute on function public.transition_task_workflow(jsonb) to authenticated;
