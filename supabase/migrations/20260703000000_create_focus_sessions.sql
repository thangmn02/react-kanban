-- Focus session history for Pomodoro / Today stats.
--
-- This is the tracked Supabase migration for `public.focus_sessions` (promoted
-- from the previously untracked `docs/sql/focus-sessions.sql`). It creates the
-- table, supporting indexes, and workspace-scoped RLS policies.
--
-- NOTE: this migration references `public.workspaces`, `public.boards`, and
-- `public.tasks`, which are expected to already exist. A reproducible baseline
-- schema migration for those core tables is the remaining Phase 4 step (see
-- README "Known limitations") — `supabase db reset` from an empty clone is not
-- yet verified to succeed.

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('focus', 'shortBreak', 'longBreak')),
  status text not null check (status in ('completed', 'interrupted', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null check (duration_seconds >= 0),
  planned_seconds integer not null check (planned_seconds > 0),
  created_at timestamptz not null default now()
);

create index if not exists focus_sessions_workspace_created_idx
on public.focus_sessions (workspace_id, created_at desc);

create index if not exists focus_sessions_user_created_idx
on public.focus_sessions (user_id, created_at desc);

create index if not exists focus_sessions_task_created_idx
on public.focus_sessions (task_id, created_at desc);

alter table public.focus_sessions enable row level security;

drop policy if exists "Workspace members can read focus sessions" on public.focus_sessions;
create policy "Workspace members can read focus sessions"
on public.focus_sessions
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = focus_sessions.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert their focus sessions" on public.focus_sessions;
create policy "Users can insert their focus sessions"
on public.focus_sessions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = focus_sessions.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their focus sessions" on public.focus_sessions;
create policy "Users can update their focus sessions"
on public.focus_sessions
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = focus_sessions.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = focus_sessions.workspace_id
      and wm.user_id = auth.uid()
  )
);
