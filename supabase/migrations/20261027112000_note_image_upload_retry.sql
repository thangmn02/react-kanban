-- The caller owns an upload identity, so lost network responses never allocate
-- another attachment. The server decodes the same image before every retry.
create or replace function public.reserve_note_image(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=(request->>'noteId')::uuid; image_id uuid:=(request->>'id')::uuid; image_row public.note_images; parent public.notes;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed.' using errcode='42501'; end if;
  select * into parent from public.notes where id=target for update;
  perform 1 from public.workspace_members where workspace_id=parent.workspace_id and user_id=auth.uid() for share;
  if not app_private.note_permission(target,'edit') then raise exception 'Note edit permission is required.' using errcode='42501'; end if;
  if image_id is null then raise exception 'An image identity is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('note-image-reservation:'||auth.uid()::text,0));
  select * into image_row from public.note_images where id=image_id for update;
  if found then
    if image_row.note_id is distinct from target or image_row.created_by is distinct from auth.uid() or image_row.state='retired'
      or image_row.sha256 is distinct from request->>'sha256' or image_row.mime_type is distinct from request->>'mimeType'
      or image_row.byte_size is distinct from (request->>'byteSize')::integer or image_row.width is distinct from (request->>'width')::integer
      or image_row.height is distinct from (request->>'height')::integer then raise exception 'This upload identity belongs to a different image or expired operation.' using errcode='PT409'; end if;
    return to_jsonb(image_row);
  end if;
  if (select count(*) from public.note_images where created_by=auth.uid() and state='pending')>=100 then raise exception 'Finish or clean up pending image uploads before retrying.'; end if;
  if (select count(*) from public.note_images where note_id=target and state<>'retired')>=100 then raise exception 'This note has reached its image storage limit. Remove unused images before uploading more.'; end if;
  if (select count(*) from public.note_images where note_id=target and state='pending')>=12 then raise exception 'Too many unfinished images. Wait for image cleanup before retrying.'; end if;
  insert into public.note_images(id,note_id,created_by,object_path,mime_type,byte_size,width,height,sha256)
  values(image_id,target,auth.uid(),target::text||'/'||image_id::text,request->>'mimeType',(request->>'byteSize')::integer,(request->>'width')::integer,(request->>'height')::integer,request->>'sha256') returning * into image_row;
  return to_jsonb(image_row);
end;
$$;
