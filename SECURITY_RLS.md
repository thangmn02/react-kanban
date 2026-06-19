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
