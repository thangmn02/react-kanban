-- Task cover uploads use Supabase Storage plus the existing public.tasks.image
-- column for the resolved public URL. No task table migration is required.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-covers',
  'task-covers',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can read task covers" on storage.objects;
create policy "Workspace members can read task covers"
on storage.objects
for select
using (
  bucket_id = 'task-covers'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can upload task covers" on storage.objects;
create policy "Workspace editors can upload task covers"
on storage.objects
for insert
with check (
  bucket_id = 'task-covers'
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can update task covers" on storage.objects;
create policy "Workspace editors can update task covers"
on storage.objects
for update
using (
  bucket_id = 'task-covers'
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'task-covers'
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Workspace editors can delete task covers" on storage.objects;
create policy "Workspace editors can delete task covers"
on storage.objects
for delete
using (
  bucket_id = 'task-covers'
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
);
