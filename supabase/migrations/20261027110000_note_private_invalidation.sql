-- Only identity-scoped wake-ups are broadcast. Receivers re-run resource RLS.
do $$
declare relation text;
begin
  foreach relation in array array['notes','note_access','note_comments','note_task_links'] loop
    if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=relation) then
      execute format('alter publication supabase_realtime drop table public.%I',relation);
    end if;
  end loop;
end;
$$;
create policy kora_notes_receive_own_invalidations on realtime.messages for select to authenticated
using(extension='broadcast' and realtime.topic()='notes:user:'||auth.uid()::text);
-- These guards also hold in the presence of another app's permissive policies.
create policy kora_notes_private_topic_isolation on realtime.messages as restrictive for select to anon,authenticated
using(realtime.topic() not like 'notes:user:%' or (extension='broadcast' and realtime.topic()='notes:user:'||auth.uid()::text));
create policy kora_notes_no_client_notifications on realtime.messages as restrictive for insert to anon,authenticated
with check(realtime.topic() not like 'notes:user:%');

create function app_private.note_notification_audience(target_note_id uuid) returns uuid[]
language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct recipient),array[]::uuid[]) from (
    select n.owner_user_id as recipient from public.notes n where n.id=target_note_id
    union select a.user_id from public.note_access a where a.note_id=target_note_id
    union select m.user_id from public.notes n join public.workspace_members m on m.workspace_id=n.workspace_id where n.id=target_note_id and n.visibility='workspace'
  ) audience join public.notes target on target.id=target_note_id
  where target.workspace_id is null or exists(select 1 from public.workspace_members membership where membership.workspace_id=target.workspace_id and membership.user_id=audience.recipient);
$$;
create function app_private.send_note_invalidation(recipients uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  for recipient in select distinct item from unnest(recipients) item where item is not null loop
    perform realtime.send(jsonb_build_object('version',1),'invalidate','notes:user:'||recipient::text,true);
  end loop;
end;
$$;
create function app_private.notify_note_document_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipients uuid[]:=array[]::uuid[]; previous_members uuid[];
begin
  if tg_op<>'INSERT' then
    recipients:=array_append(recipients,old.owner_user_id);
    if old.visibility='workspace' then
      select array_agg(m.user_id) into previous_members from public.workspace_members m where m.workspace_id=old.workspace_id;
      recipients:=recipients||coalesce(previous_members,array[]::uuid[]);
    end if;
  end if;
  if tg_op<>'DELETE' then recipients:=recipients||app_private.note_notification_audience(new.id); end if;
  perform app_private.send_note_invalidation(recipients); return null;
end;
$$;
create trigger notify_note_document_change after insert or update or delete on public.notes for each row execute function app_private.notify_note_document_change();

create function app_private.notify_note_resource_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipients uuid[]:=array[]::uuid[];
begin
  if tg_op<>'INSERT' then
    recipients:=recipients||app_private.note_notification_audience(old.note_id);
    if tg_table_name='note_access' then recipients:=array_append(recipients,(to_jsonb(old)->>'user_id')::uuid); end if;
  end if;
  if tg_op<>'DELETE' then recipients:=recipients||app_private.note_notification_audience(new.note_id); end if;
  perform app_private.send_note_invalidation(recipients); return null;
end;
$$;
create trigger notify_note_access_change after insert or update or delete on public.note_access for each row execute function app_private.notify_note_resource_change();
create trigger notify_note_comment_change after insert or update or delete on public.note_comments for each row execute function app_private.notify_note_resource_change();
create trigger notify_note_task_link_change after insert or update or delete on public.note_task_links for each row execute function app_private.notify_note_resource_change();

create function app_private.notify_note_presentation_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.send_note_invalidation(array[coalesce(new.user_id,old.user_id)]); return null;
end;
$$;
create trigger notify_note_presentation_change after insert or update or delete on public.note_user_presentation for each row execute function app_private.notify_note_presentation_change();
create function app_private.notify_note_membership_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op<>'INSERT' then perform app_private.send_note_invalidation(array[old.user_id]); end if;
  if tg_op<>'DELETE' then perform app_private.send_note_invalidation(array[new.user_id]); end if;
  return null;
end;
$$;
create trigger notify_note_membership_change after insert or update or delete on public.workspace_members for each row execute function app_private.notify_note_membership_change();
revoke all on function app_private.note_notification_audience(uuid),app_private.send_note_invalidation(uuid[]),app_private.notify_note_document_change(),app_private.notify_note_resource_change(),app_private.notify_note_presentation_change(),app_private.notify_note_membership_change() from public,anon,authenticated;
