# Supabase RLS Security Checklist

The Supabase anon key is public in the browser. Client-side filters are not an access-control boundary, so tenant isolation must be enforced by database Row-Level Security.

## Required Core Table Policies

Verify these tables have RLS enabled and no permissive `USING (true)` / `WITH CHECK (true)` policies:

| Table | Required read boundary | Required write boundary |
| --- | --- | --- |
| `boards` | workspace members only | workspace editors only |
| `lists` | workspace members only | workspace editors only |
| `tasks` | workspace members only | workspace editors only |
| `workspace_invites` | workspace managers or the invited JWT email | workspace managers only |

## Verification Queries

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('tasks', 'lists', 'boards', 'workspace_invites')
order by tablename;
```

Expected: every row has `rowsecurity = true`.

```sql
select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('tasks', 'lists', 'boards', 'workspace_invites')
order by tablename, policyname;
```

Expected: policies reference `is_workspace_member`, `can_edit_workspace`, or `can_manage_workspace_members`; none of these four tables has a broad true policy.

## Atomic Task Reordering

Task reordering should go through `public.update_task_positions(jsonb)` so the database validates all task/list/workspace relationships and applies the reorder in one transaction.

```sql
select
  routine_schema,
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'update_task_positions';
```

Expected: one `public.update_task_positions` function with `security_type = INVOKER`.

## Read-only Share Links

Migration `20261111100000_board_share_links.sql` lets a workspace owner or admin publish one board as a read-only page.

- `board_share_links` stores only the SHA-256 of each token. RLS is enabled; `anon` has no table grant.
- `authenticated` may select and insert, and update the `revoked_at` column only; every policy requires `app_private.can_manage_workspace_members`.
- `anon` reads through `public.get_shared_board(text)` alone. It is `SECURITY DEFINER` with an empty `search_path` and returns the board title, list titles, and per task: title, list, priority, due date, done flag, update time and assignee display names. Nothing else.

```sql
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'board_share_links' order by 1, 2;
```

Expected: no row for `anon`; `authenticated` has `SELECT` and `INSERT` only (plus a column grant on `revoked_at`).

```sql
select public.get_shared_board('not-a-real-token-not-a-real-token-not-a-real-token');
```

Expected: `null`. A revoked link and a link whose board is archived must also return `null`.

Before relying on this in production, run these on the real database as `anon`: a member (not manager) cannot insert a link; a manager of workspace A cannot insert a link for a board of workspace B; a revoked link returns `null`.

