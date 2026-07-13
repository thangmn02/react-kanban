-- Create task_activities table
CREATE TABLE IF NOT EXISTS public.task_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL,
  actor JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by task_id
CREATE INDEX IF NOT EXISTS task_activities_task_id_idx ON public.task_activities (task_id);

-- Enable RLS (Row Level Security) if your project uses it
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for simplicity in this demo board
CREATE POLICY "Allow all public actions" ON public.task_activities
  FOR ALL
  USING (true)
  WITH CHECK (true);
