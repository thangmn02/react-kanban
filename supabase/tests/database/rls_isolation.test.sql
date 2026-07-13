begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_temp;

select plan(33);

-- Fixed identities keep failures readable while the surrounding transaction
-- and final rollback keep the local database unchanged.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'owner-one@example.test', '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', 'owner-two@example.test', '{}'::jsonb);

insert into public.workspaces (id, name, owner_id)
values
  ('a0000000-0000-0000-0000-000000000001', 'Workspace One', '10000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Workspace Two', '20000000-0000-0000-0000-000000000002');

insert into public.boards (id, title, workspace_id, created_by)
values
  ('a1000000-0000-0000-0000-000000000001', 'Board One', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002', 'Board Two', 'b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

insert into public.lists (id, board_id, title, workspace_id)
values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'List One', 'a0000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'List Two', 'b0000000-0000-0000-0000-000000000002');

insert into public.tasks (id, board_id, list_id, title, workspace_id, created_by)
values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Task One', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Task Two', 'b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

insert into public.focus_sessions (
  id, workspace_id, board_id, task_id, user_id, mode, status,
  started_at, ended_at, duration_seconds, planned_seconds
)
values
  ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'focus', 'completed', now() - interval '25 minutes', now(), 1500, 1500),
  ('b4000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'focus', 'completed', now() - interval '25 minutes', now(), 1500, 1500);

insert into public.workspace_invites (id, workspace_id, email, role, invited_by)
values
  ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'invite-one@example.test', 'member', '10000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'invite-two@example.test', 'member', '20000000-0000-0000-0000-000000000002');

insert into storage.objects (id, bucket_id, name, owner_id)
values
  ('a6000000-0000-0000-0000-000000000001', 'task-covers', 'a0000000-0000-0000-0000-000000000001/a3000000-0000-0000-0000-000000000001/one.png', '10000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000002', 'task-covers', 'b0000000-0000-0000-0000-000000000002/b3000000-0000-0000-0000-000000000002/two.png', '20000000-0000-0000-0000-000000000002');

select is((select relrowsecurity from pg_class where oid = 'public.boards'::regclass), true, 'boards has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.lists'::regclass), true, 'lists has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), true, 'tasks has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.focus_sessions'::regclass), true, 'focus_sessions has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.workspace_members'::regclass), true, 'workspace_members has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.workspace_invites'::regclass), true, 'workspace_invites has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), true, 'task-cover objects have RLS enabled');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"owner-one@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq('select count(*) from public.boards', array[1::bigint], 'user one sees only workspace-one boards');
select results_eq('select count(*) from public.lists', array[1::bigint], 'user one sees only workspace-one lists');
select results_eq('select count(*) from public.tasks', array[1::bigint], 'user one sees only workspace-one tasks');
select results_eq('select count(*) from public.focus_sessions', array[1::bigint], 'user one sees only workspace-one focus sessions');
select results_eq('select count(*) from public.workspace_members', array[1::bigint], 'user one sees only workspace-one memberships');
select results_eq('select count(*) from public.workspace_invites', array[1::bigint], 'user one sees only workspace-one invites');
select results_eq($$select count(*) from storage.objects where bucket_id = 'task-covers'$$, array[1::bigint], 'user one sees only workspace-one task covers');
select is_empty($$update public.tasks set title = 'blocked' where id = 'b3000000-0000-0000-0000-000000000002' returning 1$$, 'user one cannot update workspace-two tasks');
select is_empty($$delete from public.boards where id = 'b1000000-0000-0000-0000-000000000002' returning 1$$, 'user one cannot delete workspace-two boards');

select throws_like(
  $$insert into public.boards (title, workspace_id) values ('blocked board', 'b0000000-0000-0000-0000-000000000002')$$,
  '%row-level security policy%',
  'user one cannot insert workspace-two boards'
);
select throws_like(
  $$insert into public.lists (board_id, title, workspace_id) values ('b1000000-0000-0000-0000-000000000002', 'blocked list', 'b0000000-0000-0000-0000-000000000002')$$,
  '%List must belong to a board with a workspace.%',
  'user one cannot insert workspace-two lists'
);
select throws_like(
  $$insert into public.tasks (board_id, list_id, title, workspace_id) values ('b1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'blocked task', 'b0000000-0000-0000-0000-000000000002')$$,
  '%row-level security policy%',
  'user one cannot insert workspace-two tasks'
);
select throws_like(
  $$insert into public.focus_sessions (workspace_id, user_id, mode, status, started_at, duration_seconds, planned_seconds) values ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'focus', 'completed', now(), 0, 1500)$$,
  '%row-level security policy%',
  'user one cannot create a focus session for another user'
);
select throws_like(
  $$insert into public.focus_sessions (workspace_id, user_id, mode, status, started_at, duration_seconds, planned_seconds) values ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'focus', 'completed', now(), 0, 1500)$$,
  '%row-level security policy%',
  'user one cannot create a focus session in workspace two'
);
select throws_like(
  $$insert into public.workspace_members (workspace_id, user_id, role) values ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'member')$$,
  '%row-level security policy%',
  'user one cannot add a workspace-two membership'
);
select throws_like(
  $$insert into public.workspace_invites (workspace_id, email, role) values ('b0000000-0000-0000-0000-000000000002', 'blocked@example.test', 'member')$$,
  '%row-level security policy%',
  'user one cannot create workspace-two invites'
);
select throws_like(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('task-covers', 'b0000000-0000-0000-0000-000000000002/blocked.png', '10000000-0000-0000-0000-000000000001')$$,
  '%row-level security policy%',
  'user one cannot upload task covers into workspace two'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('task-covers', 'a0000000-0000-0000-0000-000000000001/allowed.png', '10000000-0000-0000-0000-000000000001')$$,
  'user one can upload task covers into workspace one'
);

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"owner-two@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq('select count(*) from public.boards', array[1::bigint], 'user two sees only workspace-two boards');
select results_eq('select count(*) from public.lists', array[1::bigint], 'user two sees only workspace-two lists');
select results_eq('select count(*) from public.tasks', array[1::bigint], 'user two sees only workspace-two tasks');
select results_eq('select count(*) from public.focus_sessions', array[1::bigint], 'user two sees only workspace-two focus sessions');
select results_eq('select count(*) from public.workspace_members', array[1::bigint], 'user two sees only workspace-two memberships');
select results_eq('select count(*) from public.workspace_invites', array[1::bigint], 'user two sees only workspace-two invites');
select results_eq($$select count(*) from storage.objects where bucket_id = 'task-covers'$$, array[1::bigint], 'user two sees only workspace-two task covers');
select results_eq($$select count(*) from public.tasks where id = 'a3000000-0000-0000-0000-000000000001'$$, array[0::bigint], 'user two cannot read workspace-one tasks');

reset role;
select * from finish();
rollback;
