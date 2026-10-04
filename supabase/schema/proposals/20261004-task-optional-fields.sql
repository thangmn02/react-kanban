-- REVIEW ONLY. Not applied to the hosted database or migration history.
-- Follow supabase/schema/README.md backup requirements before deployment.
-- Run as one transaction; existing tasks and RLS policies are preserved.
begin;
set local lock_timeout = '5s';

alter table public.tasks add column if not exists repeat_interval text;
alter table public.tasks add column if not exists attachments jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_repeat_interval_check') then
    alter table public.tasks add constraint tasks_repeat_interval_check
      check (repeat_interval is null or repeat_interval in ('daily', 'weekly', 'monthly'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_attachments_array_check') then
    alter table public.tasks add constraint tasks_attachments_array_check
      check (jsonb_typeof(attachments) = 'array');
  end if;
end $$;

comment on column public.tasks.repeat_interval is 'Next occurrence after completion: daily, weekly or monthly.';
comment on column public.tasks.attachments is 'Task link attachments: array of id, name, url and type objects. No uploaded file contents.';
notify pgrst, 'reload schema';
commit;
