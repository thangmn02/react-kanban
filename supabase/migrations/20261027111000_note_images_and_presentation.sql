-- Assets inherit their parent's current permission. Client HTML stores identity,
-- never a signed URL or image bytes. Only the authenticated upload server writes objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kora-note-images','kora-note-images',false,2097152,array['image/png','image/jpeg']);
create table public.note_images (
  id uuid primary key,
  note_id uuid not null references public.notes(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  object_path text not null unique,
  mime_type text not null check(mime_type in ('image/png','image/jpeg')),
  byte_size integer not null check(byte_size between 1 and 2097152),
  width integer not null check(width between 1 and 2048),
  height integer not null check(height between 1 and 2048),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check(state in ('pending','ready','retired')),
  created_at timestamptz not null default now(),
  check(object_path=note_id::text||'/'||id::text)
);
create index note_images_parent on public.note_images(note_id);
create index note_images_pending_cleanup on public.note_images(created_at) where state='pending';
alter table public.note_images enable row level security;
revoke all on public.note_images from anon,authenticated;
grant select on public.note_images to authenticated;
grant all on public.note_images to service_role;
create policy note_images_read on public.note_images for select to authenticated
using(state='ready' and (app_private.note_permission(note_id,'view') or app_private.note_permission(note_id,'manage')));
create function app_private.can_read_note_image(path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.note_images i where i.object_path=path and i.state='ready'
    and (app_private.note_permission(i.note_id,'view') or app_private.note_permission(i.note_id,'manage')));
$$;
revoke all on function app_private.can_read_note_image(text) from public,anon;
grant execute on function app_private.can_read_note_image(text) to authenticated;
create policy note_images_download on storage.objects for select to authenticated
using(bucket_id='kora-note-images' and app_private.can_read_note_image(name));
-- Restrictive guards prevent an unrelated broad Storage policy granting access.
create policy note_images_read_isolation on storage.objects as restrictive for select to anon,authenticated
using(bucket_id<>'kora-note-images' or app_private.can_read_note_image(name));
create policy note_images_server_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'kora-note-images');
create policy note_images_server_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'kora-note-images') with check(bucket_id<>'kora-note-images');
create policy note_images_server_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'kora-note-images');

create function public.reserve_note_image(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=(request->>'noteId')::uuid; image_id uuid:=(request->>'id')::uuid; image_row public.note_images; parent public.notes;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed.' using errcode='42501'; end if;
  select * into parent from public.notes where id=target for update;
  perform 1 from public.workspace_members where workspace_id=parent.workspace_id and user_id=auth.uid() for share;
  if not app_private.note_permission(target,'edit') then raise exception 'Note edit permission is required.' using errcode='42501'; end if;
  if image_id is null then raise exception 'An image identity is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('note-image-reservation:'||auth.uid()::text,0));
  if (select count(*) from public.note_images where created_by=auth.uid() and state='pending')>=100 then raise exception 'Finish or clean up pending image uploads before retrying.'; end if;
  if (select count(*) from public.note_images where note_id=target and state<>'retired')>=100 then raise exception 'This note has reached its image storage limit. Remove unused images before uploading more.'; end if;
  if (select count(*) from public.note_images where note_id=target and state='pending')>=12 then raise exception 'Too many unfinished images. Wait for image cleanup before retrying.'; end if;
  insert into public.note_images(id,note_id,created_by,object_path,mime_type,byte_size,width,height,sha256)
  values(image_id,target,auth.uid(),target::text||'/'||image_id::text,request->>'mimeType',(request->>'byteSize')::integer,(request->>'width')::integer,(request->>'height')::integer,request->>'sha256')
  returning * into image_row;
  return to_jsonb(image_row);
end;
$$;
create function public.finalize_note_image(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare image_row public.note_images; parent public.notes; object_row storage.objects;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed.' using errcode='42501'; end if;
  -- Parent before asset is the common write lock order, including retirement.
  select * into image_row from public.note_images where id=(request->>'id')::uuid;
  select * into parent from public.notes where id=image_row.note_id for update;
  perform 1 from public.workspace_members where workspace_id=parent.workspace_id and user_id=auth.uid() for share;
  select * into image_row from public.note_images where id=(request->>'id')::uuid for update;
  if image_row.created_by is distinct from auth.uid() or not app_private.note_permission(image_row.note_id,'edit') or image_row.state='retired' then raise exception 'Image finalization is unavailable.' using errcode='42501'; end if;
  select * into object_row from storage.objects where bucket_id='kora-note-images' and name=image_row.object_path;
  if object_row.id is null or object_row.metadata->>'mimetype' is distinct from image_row.mime_type
    or (object_row.metadata->>'size')::bigint is distinct from image_row.byte_size::bigint
    or object_row.user_metadata->>'sha256' is distinct from image_row.sha256
    or (object_row.user_metadata->>'width')::integer is distinct from image_row.width
    or (object_row.user_metadata->>'height')::integer is distinct from image_row.height
    then raise exception 'The verified image upload is incomplete.'; end if;
  update public.note_images set state='ready' where id=image_row.id returning * into image_row;
  return to_jsonb(image_row);
end;
$$;
create function public.retire_note_image(request jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare image_row public.note_images; parent public.notes;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed.' using errcode='42501'; end if;
  select * into image_row from public.note_images where id=(request->>'id')::uuid;
  select * into parent from public.notes where id=image_row.note_id for update;
  perform 1 from public.workspace_members where workspace_id=parent.workspace_id and user_id=auth.uid() for share;
  select * into image_row from public.note_images where id=(request->>'id')::uuid for update;
  if not (app_private.note_permission(image_row.note_id,'manage') or (image_row.created_by=auth.uid() and app_private.note_permission(image_row.note_id,'edit'))) then raise exception 'Image management permission is required.' using errcode='42501'; end if;
  if exists(select 1 from app_private.note_image_references(parent.content->>'html') reference where reference=image_row.id) then raise exception 'Save the note without this image before removing its file.'; end if;
  update public.note_images set state='retired' where id=image_row.id;
end;
$$;

create function app_private.note_image_references(html text) returns setof uuid
language sql immutable set search_path='' as $$
  select distinct match[1]::uuid from regexp_matches(html,'data-kora-note-image="([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"','gi') match;
$$;
create function app_private.validate_note_images() returns trigger
language plpgsql security definer set search_path='' as $$
declare tag text[]; identity text[];
begin
  for tag in select regexp_matches(new.content->>'html','<img\y[^>]*>','gi') loop
    identity:=regexp_match(tag[1],'^<img data-kora-note-image="([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"(\s[^>]*)?>$','i');
    if identity is null or tag[1] ~* '\s(src|srcset|on[a-z]+|style)\s*=' then raise exception 'Images must use a verified note attachment.'; end if;
    if not exists(select 1 from public.note_images i where i.id=identity[1]::uuid and i.note_id=new.id and i.state='ready') then raise exception 'An image is unavailable in this note.' using errcode='42501'; end if;
  end loop;
  return new;
end;
$$;
create trigger validate_note_images before insert or update of content on public.notes for each row execute function app_private.validate_note_images();
create trigger notify_note_image_change after insert or update or delete on public.note_images for each row execute function app_private.notify_note_resource_change();

create function app_private.validate_note_presentation() returns trigger
language plpgsql set search_path='' as $$
declare item record;
begin
  for item in select key,value from jsonb_each(new.presentation) loop
    if item.key in ('pinned','minimized','expanded','floating','hidden','collapsed','clickThrough','headerVisible') then
      if jsonb_typeof(item.value)<>'boolean' then raise exception 'Invalid note presentation flag.'; end if;
    elsif item.key='color' then
      if item.value#>>'{}' not in ('paper','mint','sky','rose','slate') then raise exception 'Invalid note color.'; end if;
    elsif item.key in ('x','y','width','height','bubbleX','bubbleY','opacity','fontSize') then
      if jsonb_typeof(item.value)<>'number' then raise exception 'Invalid note presentation dimension.'; end if;
      if not (case item.key
        when 'opacity' then (item.value#>>'{}')::numeric between 0.3 and 1
        when 'fontSize' then (item.value#>>'{}')::numeric between 12 and 20
        when 'width' then (item.value#>>'{}')::numeric between 260 and 900
        when 'height' then (item.value#>>'{}')::numeric between 280 and 900
        else (item.value#>>'{}')::numeric between 0 and 3000 end) then raise exception 'Note presentation is outside supported bounds.'; end if;
    else raise exception 'Unknown note presentation field.';
    end if;
  end loop;
  return new;
end;
$$;
create trigger validate_note_presentation before insert or update of presentation on public.note_user_presentation for each row execute function app_private.validate_note_presentation();

create function public.move_note(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=(request->>'id')::uuid; destination uuid:=(request->>'workspaceId')::uuid; parent public.notes;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into parent from public.notes where id=target for update;
  perform 1 from public.workspace_members where workspace_id in (parent.workspace_id,destination) and user_id=auth.uid() order by workspace_id for share;
  if not app_private.note_permission(target,'manage') or parent.deleted_at is not null then raise exception 'Note management permission is required.' using errcode='42501'; end if;
  if parent.revision is distinct from (request->>'expectedRevision')::bigint then raise exception 'The note changed. Refresh before moving.' using errcode='PT409'; end if;
  if destination is not null and not app_private.can_edit_workspace(destination) then raise exception 'Destination edit permission is required.' using errcode='42501'; end if;
  if parent.workspace_id is not distinct from destination then return to_jsonb(parent); end if;
  if exists(select 1 from public.note_task_links where note_id=target and (workspace_id is distinct from destination and destination is not null or not app_private.is_workspace_member(workspace_id))) then
    if coalesce((request->>'clearTaskLink')::boolean,false) is not true then raise exception 'Confirm removal of the incompatible task link before moving.'; end if;
    delete from public.note_task_links where note_id=target;
    parent.content:=parent.content-'convertedTaskId';
  end if;
  -- Notify old recipients before removing their access. The destination is private.
  perform app_private.send_note_invalidation(app_private.note_notification_audience(target));
  delete from public.note_access where note_id=target;
  delete from public.note_user_presentation where note_id=target and user_id<>auth.uid();
  update public.notes set workspace_id=destination,visibility='private',content=parent.content,revision=revision+1,write_token=gen_random_uuid(),updated_at=clock_timestamp() where id=target returning * into parent;
  return to_jsonb(parent);
end;
$$;
revoke all on function public.reserve_note_image(jsonb),public.finalize_note_image(jsonb),public.retire_note_image(jsonb),public.move_note(jsonb) from public,anon;
grant execute on function public.reserve_note_image(jsonb),public.finalize_note_image(jsonb),public.retire_note_image(jsonb),public.move_note(jsonb) to authenticated;
revoke all on function app_private.validate_note_images(),app_private.validate_note_presentation(),app_private.note_image_references(text) from public,anon,authenticated;

-- Service-only maintenance claims expired reservations before deleting bytes.
create function public.note_image_cleanup_candidates() returns table(object_path text)
language plpgsql security definer set search_path='' as $$
begin
  update public.note_images i set state='retired' where i.id in
    (select candidate.id from public.note_images candidate where candidate.state='pending' and candidate.created_at<now()-interval '24 hours' order by candidate.created_at limit 100 for update skip locked);
  return query select o.name from storage.objects o where o.bucket_id='kora-note-images'
    and o.name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'
    and not exists(select 1 from public.note_images i where i.object_path=o.name and i.state<>'retired') limit 100;
end;
$$;
revoke all on function public.note_image_cleanup_candidates() from public,anon,authenticated;
grant execute on function public.note_image_cleanup_candidates() to service_role;
