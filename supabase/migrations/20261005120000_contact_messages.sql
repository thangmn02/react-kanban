-- Apply only after backing up the target database.
create table app_private.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 10 and 5000),
  notified_at timestamptz,
  notification_id text
);

create table app_private.contact_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  message_count integer not null check (message_count between 1 and 3)
);

alter table app_private.contact_messages enable row level security;
alter table app_private.contact_rate_limits enable row level security;
revoke all on app_private.contact_messages, app_private.contact_rate_limits from public, anon, authenticated;
grant select, update on app_private.contact_messages to service_role;
grant usage on schema app_private to service_role;

-- Limit admission and message persistence share one transaction. The upsert
-- locks the IP bucket, so parallel function instances cannot exceed the limit.
create function public.submit_contact_message(
  p_ip_hash text, p_name text, p_email text, p_subject text, p_message text
) returns table(message_id uuid, retry_after integer)
language plpgsql security definer set search_path = '' as $$
declare
  admitted_at timestamptz;
  new_id uuid;
begin
  insert into app_private.contact_rate_limits as limits (ip_hash, window_started_at, message_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
    set window_started_at = case when limits.window_started_at <= now() - interval '1 hour' then now() else limits.window_started_at end,
        message_count = case when limits.window_started_at <= now() - interval '1 hour' then 1 else limits.message_count + 1 end
    where limits.window_started_at <= now() - interval '1 hour' or limits.message_count < 3
  returning window_started_at into admitted_at;

  if not found then
    return query select null::uuid, greatest(1, ceil(extract(epoch from (window_started_at + interval '1 hour' - now())))::integer)
      from app_private.contact_rate_limits where ip_hash = p_ip_hash;
    return;
  end if;

  insert into app_private.contact_messages (name, email, subject, message)
  values (p_name, p_email, p_subject, p_message) returning id into new_id;
  return query select new_id, 0;
end;
$$;
revoke all on function public.submit_contact_message(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text) to service_role;

-- Keep the private schema outside PostgREST's exposed schemas.
create function public.record_contact_notification(p_message_id uuid, p_notification_id text)
returns void language sql security definer set search_path = '' as $$
  update app_private.contact_messages
  set notified_at = now(), notification_id = p_notification_id
  where id = p_message_id;
$$;
revoke all on function public.record_contact_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.record_contact_notification(uuid, text) to service_role;
