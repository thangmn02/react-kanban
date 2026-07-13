-- Keep task drag reordering behind the authenticated RPC after moving RLS
-- helper functions out of the public schema.

create or replace function public.update_task_positions(task_positions jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
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

  insert into pg_temp.task_position_updates (id, list_id, position)
  select payload.id, payload.list_id, payload.position
  from jsonb_to_recordset(task_positions) as payload(
    id uuid,
    list_id uuid,
    position integer
  );

  select count(*) into input_count
  from pg_temp.task_position_updates;

  if input_count = 0 then
    return;
  end if;

  if exists (
    select 1
    from pg_temp.task_position_updates
    group by id
    having count(*) > 1
  ) then
    raise exception 'Task positions payload contains duplicate task ids.';
  end if;

  if exists (
    select 1
    from pg_temp.task_position_updates update_row
    left join public.tasks task_row
      on task_row.id = update_row.id
    left join public.lists list_row
      on list_row.id = update_row.list_id
    where task_row.id is null
      or list_row.id is null
      or list_row.board_id <> task_row.board_id
      or list_row.workspace_id is distinct from task_row.workspace_id
      or not app_private.can_edit_workspace(task_row.workspace_id)
  ) then
    raise exception 'Task positions payload contains inaccessible or invalid task moves.';
  end if;

  update public.tasks task_row
  set
    list_id = update_row.list_id,
    position = update_row.position,
    updated_at = now()
  from pg_temp.task_position_updates update_row
  where task_row.id = update_row.id;

  get diagnostics updated_count = row_count;

  if updated_count <> input_count then
    raise exception 'Task reorder only updated % of % tasks.', updated_count, input_count;
  end if;
end;
$$;

grant usage on schema app_private to authenticated;
grant execute on function app_private.can_edit_workspace(uuid) to authenticated;

revoke all on function public.update_task_positions(jsonb) from public, anon;
grant execute on function public.update_task_positions(jsonb) to authenticated;
