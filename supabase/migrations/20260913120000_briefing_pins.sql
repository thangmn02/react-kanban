-- Workspace-visible pinned threads for the Home briefing.
create table if not exists public.briefing_pins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('note', 'email', 'chat', 'meeting')),
  source_label text not null,
  author_name text not null,
  quoted_text text not null check (char_length(quoted_text) between 1 and 500),
  link_url text,
  task_id uuid references public.tasks(id) on delete set null,
  why_matters text not null check (char_length(why_matters) between 1 and 300),
  pinned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists briefing_pins_workspace_id_created_at_idx
  on public.briefing_pins (workspace_id, created_at desc);

alter table public.briefing_pins enable row level security;
alter table public.briefing_pins replica identity full;

create policy "Workspace members can read briefing pins"
  on public.briefing_pins for select
  using (app_private.is_workspace_member(workspace_id));

create policy "Workspace editors can insert briefing pins"
  on public.briefing_pins for insert
  with check (
    created_by = auth.uid()
    and app_private.can_edit_workspace(workspace_id)
    and (
      task_id is null
      or exists (
        select 1 from public.tasks linked_task
        where linked_task.id = task_id
          and linked_task.workspace_id = briefing_pins.workspace_id
          and linked_task.deleted_at is null
      )
    )
  );

create policy "Pin authors and workspace editors can delete briefing pins"
  on public.briefing_pins for delete
  using (
    app_private.is_workspace_member(workspace_id)
    and (created_by = auth.uid() or app_private.can_edit_workspace(workspace_id))
  );

grant select, insert, delete on table public.briefing_pins to authenticated;
grant all on table public.briefing_pins to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'briefing_pins'
  ) then
    alter publication supabase_realtime add table public.briefing_pins;
  end if;
end
$$;
