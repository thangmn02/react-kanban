-- Phase 4: lightweight team member management for small workspaces.
-- Run this after the workspace foundation migration.
--
-- This keeps auth isolation in Supabase/RLS:
-- - users can discover profiles by exact email only for inviting
-- - owner/admin can add an existing registered user to their workspace
-- - owner/admin can update/remove non-owner memberships

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

create or replace function public.add_workspace_member_by_email(
  target_workspace_id uuid,
  member_email text,
  member_role text default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_user_id uuid;
  created_membership_id uuid;
  normalized_email text := lower(trim(member_email));
  normalized_role text := lower(trim(member_role));
begin
  if current_user_id is null then
    raise exception 'Authentication is required to add workspace members.';
  end if;

  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'Only workspace owners and admins can add members.';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Member email is required.';
  end if;

  if normalized_role not in ('admin', 'member', 'viewer') then
    raise exception 'Invalid workspace role.';
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(p.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'No registered user found for this email. Ask them to sign up first.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, target_user_id, normalized_role)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role
  returning id into created_membership_id;

  return created_membership_id;
end;
$$;

grant execute on function public.can_manage_workspace_members(uuid) to authenticated;
grant execute on function public.add_workspace_member_by_email(uuid, text, text) to authenticated;

drop policy if exists "Workspace editors can manage memberships" on public.workspace_members;

drop policy if exists "Workspace managers can insert memberships" on public.workspace_members;
create policy "Workspace managers can insert memberships"
on public.workspace_members
for insert
with check (
  public.can_manage_workspace_members(workspace_id)
  and role in ('admin', 'member', 'viewer')
);

drop policy if exists "Workspace managers can update memberships" on public.workspace_members;
create policy "Workspace managers can update memberships"
on public.workspace_members
for update
using (
  public.can_manage_workspace_members(workspace_id)
  and role <> 'owner'
)
with check (
  public.can_manage_workspace_members(workspace_id)
  and role in ('admin', 'member', 'viewer')
);

drop policy if exists "Workspace managers can delete memberships" on public.workspace_members;
create policy "Workspace managers can delete memberships"
on public.workspace_members
for delete
using (
  public.can_manage_workspace_members(workspace_id)
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
  )
);
