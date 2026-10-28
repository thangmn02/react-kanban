-- Every bookmark writer locks actor -> parent/membership -> presentation.
create or replace function public.save_note_presentation(request jsonb) returns void
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare note_id uuid:=(request->>'id')::uuid;layout jsonb:=request->'presentation';
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('saved-context:'||auth.uid()::text,0));
  perform 1 from public.notes n where n.id=note_id for share;
  perform 1 from public.workspace_members m join public.notes n on n.workspace_id=m.workspace_id where n.id=note_id and m.user_id=auth.uid() for share of m;
  if not app_private.note_permission(note_id,'view') then raise exception 'Note access is no longer available.' using errcode='42501';end if;
  if jsonb_typeof(layout) is distinct from 'object' or octet_length(layout::text)>4096 then raise exception 'Invalid note layout.';end if;
  if coalesce((request->>'onlyIfAbsent')::boolean,false) then
    insert into public.note_user_presentation(note_id,user_id,presentation) values(note_id,auth.uid(),layout) on conflict(note_id,user_id) do nothing;
  else
    insert into public.note_user_presentation(note_id,user_id,presentation) values(note_id,auth.uid(),layout) on conflict(note_id,user_id) do update set presentation=excluded.presentation,updated_at=clock_timestamp();
  end if;
end;$$;

create or replace function public.restore_note_revision(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original public.note_revisions;parent public.notes;restored jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from (request->>'actorUserId')::uuid then raise exception 'The signed-in account changed.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended((request->>'noteId'),0));
  select * into parent from public.notes where id=(request->>'noteId')::uuid for update;
  if parent.owner_user_id is distinct from auth.uid() or parent.deleted_at is not null or not app_private.note_permission(parent.id,'manage') then raise exception 'Note history is unavailable.' using errcode='42501';end if;
  select * into original from public.note_revisions where id=(request->>'revisionId')::uuid and note_id=parent.id;
  if not found then raise exception 'This revision is unavailable.';end if;
  restored:=public.save_note(jsonb_build_object('id',parent.id,'workspaceId',parent.workspace_id,'actorUserId',auth.uid(),'expectedRevision',request->'expectedRevision','writeToken',request->'writeToken','title',original.title,'content',original.content));
  if restored->>'title' is distinct from original.title or restored->'content' is distinct from original.content then raise exception 'This write token already belongs to a different note change.' using errcode='PT409';end if;
  return restored;
end;$$;
