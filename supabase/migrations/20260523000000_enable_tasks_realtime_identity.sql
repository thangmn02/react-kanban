-- Ensure tasks participates in Supabase Realtime and exposes full row data for updates/deletes.
-- REPLICA IDENTITY FULL increases WAL size, which is acceptable for the current project scale.
-- If realtime list create/delete/reorder is added later, consider evaluating the same tradeoff for public.lists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
