-- Add soft delete timestamp to tasks
ALTER TABLE public.tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add task_title to task_activities to persist titles of deleted tasks
ALTER TABLE public.task_activities ADD COLUMN task_title TEXT DEFAULT NULL;
