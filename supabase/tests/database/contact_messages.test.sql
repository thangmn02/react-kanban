begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_temp;
select plan(21);

select is((select relrowsecurity from pg_class where oid = 'app_private.contact_messages'::regclass), true, 'messages have RLS');
select is((select relrowsecurity from pg_class where oid = 'app_private.contact_rate_limits'::regclass), true, 'limits have RLS');
select ok(not has_table_privilege('anon', 'app_private.contact_messages', 'SELECT'), 'anonymous cannot read messages');
select ok(not has_table_privilege('authenticated', 'app_private.contact_messages', 'SELECT'), 'users cannot read messages');
select ok(not has_table_privilege('authenticated', 'app_private.contact_messages', 'INSERT'), 'users cannot bypass the function');
select ok(not has_table_privilege('authenticated', 'app_private.contact_rate_limits', 'UPDATE'), 'users cannot reset limits');
select ok(not has_function_privilege('anon', 'public.submit_contact_message(text,text,text,text,text)', 'EXECUTE'), 'anonymous cannot call admission');
select ok(not has_function_privilege('authenticated', 'public.submit_contact_message(text,text,text,text,text)', 'EXECUTE'), 'users cannot bypass verification');
select ok(has_schema_privilege('service_role', 'app_private', 'USAGE'), 'service can access private schema');
select ok(has_table_privilege('service_role', 'app_private.contact_messages', 'UPDATE'), 'service can mark notification delivery');
select ok(not has_function_privilege('anon', 'public.record_contact_notification(uuid,text)', 'EXECUTE'), 'anonymous cannot mark delivery');
select ok(not has_function_privilege('authenticated', 'public.record_contact_notification(uuid,text)', 'EXECUTE'), 'users cannot mark delivery');
select ok(has_function_privilege('service_role', 'public.record_contact_notification(uuid,text)', 'EXECUTE'), 'service can call delivery marker');

-- Separate transactions are unnecessary for hourly behavior: now() stays
-- fixed in this test, and the old window is moved explicitly.
create temporary table contact_admissions as
select * from public.submit_contact_message(repeat('a',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.');
insert into contact_admissions select * from public.submit_contact_message(repeat('a',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.');
insert into contact_admissions select * from public.submit_contact_message(repeat('a',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.');
select is((select count(message_id)::integer from contact_admissions), 3, 'first three messages are admitted');
select public.record_contact_notification((select message_id from contact_admissions limit 1), 'notification-test');
select ok((select notified_at is not null and notification_id = 'notification-test' from app_private.contact_messages where id = (select message_id from contact_admissions limit 1)), 'delivery marker updates the private message');
select ok((select message_id is null and retry_after between 1 and 3600 from public.submit_contact_message(repeat('a',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.')), 'fourth message is limited');
select is((select message_count from app_private.contact_rate_limits where ip_hash = repeat('a',64)), 3, 'denied requests do not increment count');
select ok((select message_id is not null from public.submit_contact_message(repeat('b',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.')), 'different IP has its own limit');
update app_private.contact_rate_limits set window_started_at = now() - interval '1 hour' where ip_hash = repeat('a',64);
select ok((select message_id is not null from public.submit_contact_message(repeat('a',64), 'Tester', 'tester@example.test', 'Feedback', 'A useful contact message.')), 'hour boundary admits a new message');
select is((select message_count from app_private.contact_rate_limits where ip_hash = repeat('a',64)), 1, 'new window starts at one');
select throws_ok($$select * from public.submit_contact_message(repeat('c',64), 'Tester', 'tester@example.test', 'Feedback', 'short')$$, '23514', null, 'invalid storage input rolls admission back');
select * from finish();
rollback;
