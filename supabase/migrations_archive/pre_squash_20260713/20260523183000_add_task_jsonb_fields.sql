do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'labels'
  ) then
    alter table public.tasks
      add column labels jsonb not null default '[]'::jsonb;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'attachments'
  ) then
    alter table public.tasks
      add column attachments jsonb not null default '[]'::jsonb;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'checklist_items'
  ) then
    alter table public.tasks
      add column checklist_items jsonb not null default '[]'::jsonb;
  end if;
end $$;

comment on column public.tasks.labels is
  'Lightweight label collection stored as jsonb for phase 1/2 UX upgrades.';

comment on column public.tasks.attachments is
  'Lightweight attachment metadata stored as jsonb. URLs only in this phase.';

comment on column public.tasks.checklist_items is
  'Lightweight checklist item collection stored as jsonb for task progress UI.';
