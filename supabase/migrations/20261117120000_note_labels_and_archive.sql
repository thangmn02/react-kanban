-- Keep-style Notes: shared archive state and content labels (content schema 2).
-- Additive. Qualify on staging through docs/connected-qualification.md before any
-- production use. Pin and colour stay per-user presentation; archive is shared by
-- every collaborator, so it is a row field. Labels live in content so they sync and
-- merge with the note.

alter table public.notes add column archived_at timestamptz;

alter table public.notes drop constraint notes_content_schema_version_check;
alter table public.notes add constraint notes_content_schema_version_check check (content_schema_version in (1,2));

-- Schema 2 adds an optional `labels` array: at most 20 strings of 1-50 characters.
create or replace function app_private.valid_note_document(document jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(document)='object' and jsonb_typeof(document->'html')='string'
    and length(document->>'html')<=60000 and octet_length(document::text)<=262144
    and case when jsonb_typeof(document->'checklist')='array' then
      jsonb_array_length(document->'checklist')<=100 and not exists(
        select 1 from jsonb_array_elements(document->'checklist') item
        where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 100
          or jsonb_typeof(item->'text') is distinct from 'string' or length(item->>'text')>500
          or jsonb_typeof(item->'isDone') is distinct from 'boolean')
      else false end
    and case when document ? 'labels' then
      jsonb_typeof(document->'labels')='array' and jsonb_array_length(document->'labels')<=20 and not exists(
        select 1 from jsonb_array_elements(document->'labels') label
        where jsonb_typeof(label) is distinct from 'string' or length(label #>> '{}') not between 1 and 50)
      else true end,false);
$$;

-- Older clients send content without `labels`; keep the stored labels instead of
-- erasing them. The schema version follows the stored document.
create function app_private.note_content_schema() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and not (new.content ? 'labels') and old.content ? 'labels' then
    new.content := jsonb_set(new.content,'{labels}',old.content->'labels');
  end if;
  new.content_schema_version := case when new.content ? 'labels' then 2 else 1 end;
  return new;
end;
$$;
create trigger note_content_schema before insert or update of content on public.notes
  for each row execute function app_private.note_content_schema();

-- Archive needs edit permission. It does not bump the revision or write token, so an
-- in-flight edit by a collaborator is not turned into a conflict.
create function public.set_note_archived(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare note_row public.notes; note_id uuid := (request->>'id')::uuid; archive boolean := (request->>'archived')::boolean;
begin
  if auth.uid() is null or (request->>'actorUserId')::uuid is distinct from auth.uid() then raise exception 'The signed-in account changed. Reopen Notes in the current account.' using errcode='42501'; end if;
  if note_id is null or archive is null then raise exception 'A note identity and archive state are required.'; end if;
  select * into note_row from public.notes n where n.id=note_id for update;
  perform 1 from public.workspace_members m where m.workspace_id=note_row.workspace_id and m.user_id=auth.uid() for share;
  if note_row.id is null or note_row.deleted_at is not null or not app_private.note_permission(note_id,'edit') then raise exception 'Note edit permission is required.' using errcode='42501'; end if;
  update public.notes n set archived_at=case when archive then coalesce(n.archived_at,clock_timestamp()) else null end
    where n.id=note_id returning * into note_row;
  return to_jsonb(note_row);
end;
$$;
revoke all on function public.set_note_archived(jsonb) from public,anon;
grant execute on function public.set_note_archived(jsonb) to authenticated;
