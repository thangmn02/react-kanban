create or replace function public.create_workspace_with_owner(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create a workspace.';
  end if;

  if nullif(trim(workspace_name), '') is null then
    raise exception 'Workspace name is required.';
  end if;

  insert into public.workspaces (name, owner_id)
  values (trim(workspace_name), current_user_id)
  returning id into created_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner')
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  return created_workspace_id;
end;
$$;

grant execute on function public.create_workspace_with_owner(text) to authenticated;
