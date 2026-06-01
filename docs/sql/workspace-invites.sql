-- Workspace invites for the small-team member flow.
-- Safe to run multiple times in Supabase SQL Editor.
--
-- This keeps invite creation server-side so the frontend never needs a
-- service-role key or direct access to auth.users.

create extension if not exists pgcrypto;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_id_idx
on public.workspace_invites (workspace_id);

create index if not exists workspace_invites_email_idx
on public.workspace_invites (lower(email));

create index if not exists workspace_invites_token_idx
on public.workspace_invites (token);

create unique index if not exists workspace_invites_pending_email_idx
on public.workspace_invites (workspace_id, lower(email))
where accepted_at is null;

alter table public.workspace_invites enable row level security;

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

create or replace function public.invite_workspace_member_by_email(
  target_workspace_id uuid,
  member_email text,
  member_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(member_email));
  normalized_role text := lower(trim(member_role));
  target_user_id uuid;
  existing_membership_id uuid;
  invite_row public.workspace_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to invite workspace members.';
  end if;

  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'Only workspace owners and admins can invite members.';
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

  if target_user_id is not null then
    select wm.id
    into existing_membership_id
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
    limit 1;

    if existing_membership_id is not null then
      raise exception 'This user is already a workspace member.';
    end if;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_workspace_id, target_user_id, normalized_role);

    update public.workspace_invites
    set accepted_at = coalesce(accepted_at, now())
    where workspace_id = target_workspace_id
      and lower(email) = normalized_email
      and accepted_at is null;

    return jsonb_build_object(
      'status', 'member_added',
      'invite', null
    );
  end if;

  select wi.*
  into invite_row
  from public.workspace_invites wi
  where wi.workspace_id = target_workspace_id
    and lower(wi.email) = normalized_email
    and wi.accepted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'invite_existing',
      'invite', to_jsonb(invite_row)
    );
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (target_workspace_id, normalized_email, normalized_role, current_user_id)
  returning * into invite_row;

  return jsonb_build_object(
    'status', 'invite_created',
    'invite', to_jsonb(invite_row)
  );
end;
$$;

create or replace function public.accept_workspace_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite_row public.workspace_invites%rowtype;
  existing_membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please sign in before accepting this invite.';
  end if;

  select wi.*
  into invite_row
  from public.workspace_invites wi
  where wi.token = invite_token
  limit 1;

  if not found then
    raise exception 'Invite was not found.';
  end if;

  if lower(invite_row.email) <> current_email then
    raise exception 'This invite is for a different email address.';
  end if;

  if invite_row.expires_at <= now() then
    raise exception 'This invite has expired.';
  end if;

  select wm.id
  into existing_membership_id
  from public.workspace_members wm
  where wm.workspace_id = invite_row.workspace_id
    and wm.user_id = current_user_id
  limit 1;

  if invite_row.accepted_at is not null then
    return jsonb_build_object(
      'status', 'already_accepted',
      'workspace_id', invite_row.workspace_id
    );
  end if;

  if existing_membership_id is null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (invite_row.workspace_id, current_user_id, invite_row.role);
  end if;

  update public.workspace_invites
  set accepted_at = now()
  where id = invite_row.id;

  return jsonb_build_object(
    'status', case when existing_membership_id is null then 'accepted' else 'already_member' end,
    'workspace_id', invite_row.workspace_id
  );
end;
$$;

grant execute on function public.can_manage_workspace_members(uuid) to authenticated;
grant execute on function public.invite_workspace_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

drop policy if exists "Workspace managers can read invites" on public.workspace_invites;
create policy "Workspace managers can read invites"
on public.workspace_invites
for select
using (public.can_manage_workspace_members(workspace_id));

drop policy if exists "Invited users can read their invite" on public.workspace_invites;
create policy "Invited users can read their invite"
on public.workspace_invites
for select
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Workspace managers can create invites" on public.workspace_invites;
create policy "Workspace managers can create invites"
on public.workspace_invites
for insert
with check (public.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can update invites" on public.workspace_invites;
create policy "Workspace managers can update invites"
on public.workspace_invites
for update
using (public.can_manage_workspace_members(workspace_id))
with check (public.can_manage_workspace_members(workspace_id));

drop policy if exists "Workspace managers can delete invites" on public.workspace_invites;
create policy "Workspace managers can delete invites"
on public.workspace_invites
for delete
using (public.can_manage_workspace_members(workspace_id));
