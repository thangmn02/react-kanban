-- Back up and review the target before applying. Existing task RLS remains the
-- authorization boundary; publication membership grants no table permissions.
-- The task service already subscribes to this table, but a clean local baseline
-- published only briefing_pins, so committed task changes were never delivered.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'The Supabase Realtime publication is required.';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end
$$;
