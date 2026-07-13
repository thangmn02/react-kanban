


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app_private";


ALTER SCHEMA "app_private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "app_private"."can_edit_workspace"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  );
$$;


ALTER FUNCTION "app_private"."can_edit_workspace"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_private"."can_manage_workspace_members"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "app_private"."can_manage_workspace_members"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_private"."is_workspace_member"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "app_private"."is_workspace_member"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_workspace_invite"("invite_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite_row public.workspace_invites%rowtype;
  existing_membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please sign in before accepting this invite.';
  end if;

  select wi.*
  into invite_row
  from public.workspace_invites wi
  where wi.token = invite_token
  limit 1;

  if not found then
    raise exception 'Invite was not found.';
  end if;

  if lower(invite_row.email) <> current_email then
    raise exception 'This invite is for a different email address.';
  end if;

  if invite_row.expires_at <= now() then
    raise exception 'This invite has expired.';
  end if;

  select wm.id
  into existing_membership_id
  from public.workspace_members wm
  where wm.workspace_id = invite_row.workspace_id
    and wm.user_id = current_user_id
  limit 1;

  if invite_row.accepted_at is not null then
    return jsonb_build_object(
      'status', 'already_accepted',
      'workspace_id', invite_row.workspace_id
    );
  end if;

  if existing_membership_id is null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (invite_row.workspace_id, current_user_id, invite_row.role);
  end if;

  update public.workspace_invites
  set accepted_at = now()
  where id = invite_row.id;

  return jsonb_build_object(
    'status', case when existing_membership_id is null then 'accepted' else 'already_member' end,
    'workspace_id', invite_row.workspace_id
  );
end;
$$;


ALTER FUNCTION "public"."accept_workspace_invite"("invite_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_workspace"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  );
$$;


ALTER FUNCTION "public"."can_edit_workspace"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_workspace_members"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "public"."can_manage_workspace_members"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workspace_with_owner"("workspace_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  created_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to create a workspace.';
  end if;

  if nullif(trim(workspace_name), '') is null then
    raise exception 'Workspace name is required.';
  end if;

  insert into public.workspaces (name, owner_id)
  values (trim(workspace_name), current_user_id)
  returning id into created_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner')
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  return created_workspace_id;
end;
$$;


ALTER FUNCTION "public"."create_workspace_with_owner"("workspace_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_workspace_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    new.id,
    new.owner_id,
    'owner'
  )
  on conflict (workspace_id, user_id) do update
  set role = 'owner';

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_workspace_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_workspace_member_by_email"("target_workspace_id" "uuid", "member_email" "text", "member_role" "text" DEFAULT 'member'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(member_email));
  normalized_role text := lower(trim(member_role));
  target_user_id uuid;
  existing_membership_id uuid;
  invite_row public.workspace_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to invite workspace members.';
  end if;

  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'Only workspace owners and admins can invite members.';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Member email is required.';
  end if;

  if normalized_role not in ('admin', 'member', 'viewer') then
    raise exception 'Invalid workspace role.';
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(p.email) = normalized_email
  limit 1;

  if target_user_id is not null then
    select wm.id
    into existing_membership_id
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
    limit 1;

    if existing_membership_id is not null then
      raise exception 'This user is already a workspace member.';
    end if;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_workspace_id, target_user_id, normalized_role);

    update public.workspace_invites
    set accepted_at = coalesce(accepted_at, now())
    where workspace_id = target_workspace_id
      and lower(email) = normalized_email
      and accepted_at is null;

    return jsonb_build_object(
      'status', 'member_added',
      'invite', null
    );
  end if;

  select wi.*
  into invite_row
  from public.workspace_invites wi
  where wi.workspace_id = target_workspace_id
    and lower(wi.email) = normalized_email
    and wi.accepted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'invite_existing',
      'invite', to_jsonb(invite_row)
    );
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (target_workspace_id, normalized_email, normalized_role, current_user_id)
  returning * into invite_row;

  return jsonb_build_object(
    'status', 'invite_created',
    'invite', to_jsonb(invite_row)
  );
end;
$$;


ALTER FUNCTION "public"."invite_workspace_member_by_email"("target_workspace_id" "uuid", "member_email" "text", "member_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("target_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_workspace_member"("target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_board_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.workspace_id is null then
    new.workspace_id := '00000000-0000-0000-0000-000000000001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_board_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_list_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  parent_workspace_id uuid;
begin
  select board_row.workspace_id
  into parent_workspace_id
  from public.boards board_row
  where board_row.id = new.board_id;

  if parent_workspace_id is null then
    raise exception 'List must belong to a board with a workspace.';
  end if;

  new.workspace_id := parent_workspace_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_list_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_activity_workspace_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  select task_row.workspace_id, task_row.board_id
  into new.workspace_id, new.board_id
  from public.tasks task_row
  where task_row.id = new.task_id;

  if new.workspace_id is null or new.board_id is null then
    raise exception 'Task activity must belong to a task in a workspace.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_activity_workspace_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_child_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  select task_row.workspace_id
  into new.workspace_id
  from public.tasks task_row
  where task_row.id = new.task_id;

  if new.workspace_id is null then
    raise exception 'Task child row must belong to a task in a workspace.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_child_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_label_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  select board_row.workspace_id
  into new.workspace_id
  from public.boards board_row
  where board_row.id = new.board_id;

  if new.workspace_id is null then
    raise exception 'Task label must belong to a board in a workspace.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_label_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  parent_workspace_id uuid;
begin
  select board_row.workspace_id
  into parent_workspace_id
  from public.lists list_row
  join public.boards board_row
    on board_row.id = list_row.board_id
  where list_row.id = new.list_id
    and board_row.id = new.board_id;

  if parent_workspace_id is null then
    raise exception 'Task must belong to a list and board in a workspace.';
  end if;

  new.workspace_id := parent_workspace_id;

  if new.is_done = true and new.completed_at is null then
    new.completed_at := now();
  elsif new.is_done = false then
    new.completed_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_positions"("task_positions" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  input_count integer;
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to reorder tasks.';
  end if;

  if task_positions is null or jsonb_typeof(task_positions) <> 'array' then
    raise exception 'Task positions payload must be an array.';
  end if;

  drop table if exists pg_temp.task_position_updates;

  create temporary table task_position_updates (
    id uuid not null,
    list_id uuid not null,
    position integer not null
  ) on commit drop;

  insert into pg_temp.task_position_updates (id, list_id, position)
  select payload.id, payload.list_id, payload.position
  from jsonb_to_recordset(task_positions) as payload(
    id uuid,
    list_id uuid,
    position integer
  );

  select count(*) into input_count
  from pg_temp.task_position_updates;

  if input_count = 0 then
    return;
  end if;

  if exists (
    select 1
    from pg_temp.task_position_updates
    group by id
    having count(*) > 1
  ) then
    raise exception 'Task positions payload contains duplicate task ids.';
  end if;

  if exists (
    select 1
    from pg_temp.task_position_updates update_row
    left join public.tasks task_row
      on task_row.id = update_row.id
    left join public.lists list_row
      on list_row.id = update_row.list_id
    where task_row.id is null
      or list_row.id is null
      or list_row.board_id <> task_row.board_id
      or list_row.workspace_id is distinct from task_row.workspace_id
      or not app_private.can_edit_workspace(task_row.workspace_id)
  ) then
    raise exception 'Task positions payload contains inaccessible or invalid task moves.';
  end if;

  update public.tasks task_row
  set
    list_id = update_row.list_id,
    position = update_row.position,
    updated_at = now()
  from pg_temp.task_position_updates update_row
  where task_row.id = update_row.id;

  get diagnostics updated_count = row_count;

  if updated_count <> input_count then
    raise exception 'Task reorder only updated % of % tasks.', updated_count, input_count;
  end if;
end;
$$;


ALTER FUNCTION "public"."update_task_positions"("task_positions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."focus_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "board_id" "uuid",
    "task_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer NOT NULL,
    "planned_seconds" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "focus_sessions_duration_seconds_check" CHECK (("duration_seconds" >= 0)),
    CONSTRAINT "focus_sessions_mode_check" CHECK (("mode" = ANY (ARRAY['focus'::"text", 'shortBreak'::"text", 'longBreak'::"text"]))),
    CONSTRAINT "focus_sessions_planned_seconds_check" CHECK (("planned_seconds" > 0)),
    CONSTRAINT "focus_sessions_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'interrupted'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."focus_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone,
    "workspace_id" "uuid",
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "actor" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_title" "text",
    "workspace_id" "uuid",
    "board_id" "uuid",
    "actor_id" "uuid"
);


ALTER TABLE "public"."task_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_checklist_items" (
    "id" "text" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "workspace_id" "uuid"
);

ALTER TABLE ONLY "public"."task_checklist_items" REPLICA IDENTITY FULL;


ALTER TABLE "public"."task_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_label_links" (
    "task_id" "uuid" NOT NULL,
    "label_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid"
);

ALTER TABLE ONLY "public"."task_label_links" REPLICA IDENTITY FULL;


ALTER TABLE "public"."task_label_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_labels" (
    "id" "text" NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "workspace_id" "uuid"
);

ALTER TABLE ONLY "public"."task_labels" REPLICA IDENTITY FULL;


ALTER TABLE "public"."task_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text",
    "start_date" "date",
    "due_date" "date",
    "category1" "text",
    "category2" "text",
    "assignees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "image" "text",
    "is_done" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text", 'Lowest'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_invites_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."workspace_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_pkey" PRIMARY KEY ("task_id", "label_id");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_board_id_name_key" UNIQUE ("board_id", "name");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "boards_created_by_idx" ON "public"."boards" USING "btree" ("created_by");



CREATE INDEX "boards_workspace_id_idx" ON "public"."boards" USING "btree" ("workspace_id");



CREATE INDEX "focus_sessions_task_created_idx" ON "public"."focus_sessions" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "focus_sessions_user_created_idx" ON "public"."focus_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "focus_sessions_workspace_created_idx" ON "public"."focus_sessions" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_lists_board_id" ON "public"."lists" USING "btree" ("board_id");



CREATE INDEX "idx_lists_board_position" ON "public"."lists" USING "btree" ("board_id", "position");



CREATE INDEX "idx_tasks_board_id" ON "public"."tasks" USING "btree" ("board_id");



CREATE INDEX "idx_tasks_list_id" ON "public"."tasks" USING "btree" ("list_id");



CREATE INDEX "idx_tasks_list_position" ON "public"."tasks" USING "btree" ("list_id", "position");



CREATE INDEX "lists_workspace_id_idx" ON "public"."lists" USING "btree" ("workspace_id");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "task_activities_actor_id_idx" ON "public"."task_activities" USING "btree" ("actor_id");



CREATE INDEX "task_activities_board_id_idx" ON "public"."task_activities" USING "btree" ("board_id");



CREATE INDEX "task_activities_task_id_idx" ON "public"."task_activities" USING "btree" ("task_id");



CREATE INDEX "task_activities_workspace_id_idx" ON "public"."task_activities" USING "btree" ("workspace_id");



CREATE INDEX "task_checklist_items_task_id_position_idx" ON "public"."task_checklist_items" USING "btree" ("task_id", "position");



CREATE INDEX "task_checklist_items_workspace_id_idx" ON "public"."task_checklist_items" USING "btree" ("workspace_id");



CREATE INDEX "task_label_links_label_id_idx" ON "public"."task_label_links" USING "btree" ("label_id");



CREATE INDEX "task_label_links_task_id_idx" ON "public"."task_label_links" USING "btree" ("task_id");



CREATE INDEX "task_label_links_workspace_id_idx" ON "public"."task_label_links" USING "btree" ("workspace_id");



CREATE INDEX "task_labels_board_id_idx" ON "public"."task_labels" USING "btree" ("board_id");



CREATE INDEX "task_labels_workspace_id_idx" ON "public"."task_labels" USING "btree" ("workspace_id");



CREATE INDEX "tasks_created_by_idx" ON "public"."tasks" USING "btree" ("created_by");



CREATE INDEX "tasks_workspace_id_idx" ON "public"."tasks" USING "btree" ("workspace_id");



CREATE INDEX "workspace_invites_email_idx" ON "public"."workspace_invites" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "workspace_invites_pending_email_idx" ON "public"."workspace_invites" USING "btree" ("workspace_id", "lower"("email")) WHERE ("accepted_at" IS NULL);



CREATE INDEX "workspace_invites_token_idx" ON "public"."workspace_invites" USING "btree" ("token");



CREATE INDEX "workspace_invites_workspace_id_idx" ON "public"."workspace_invites" USING "btree" ("workspace_id");



CREATE INDEX "workspace_members_user_id_idx" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "workspace_members_workspace_id_idx" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "workspaces_owner_id_idx" ON "public"."workspaces" USING "btree" ("owner_id");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "boards_set_updated_at" BEFORE UPDATE ON "public"."boards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "lists_set_updated_at" BEFORE UPDATE ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "on_workspace_created_add_owner" AFTER INSERT ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_workspace_owner"();



CREATE OR REPLACE TRIGGER "set_board_workspace_id_before_write" BEFORE INSERT OR UPDATE ON "public"."boards" FOR EACH ROW EXECUTE FUNCTION "public"."set_board_workspace_id"();



CREATE OR REPLACE TRIGGER "set_list_workspace_id_before_write" BEFORE INSERT OR UPDATE ON "public"."lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_list_workspace_id"();



CREATE OR REPLACE TRIGGER "set_task_label_workspace_id_before_write" BEFORE INSERT OR UPDATE ON "public"."task_labels" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_label_workspace_id"();



CREATE OR REPLACE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lists"
    ADD CONSTRAINT "lists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."task_labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_label_links"
    ADD CONSTRAINT "task_label_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "Authenticated users can create owned workspaces" ON "public"."workspaces" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Invited users can read their invite" ON "public"."workspace_invites" FOR SELECT USING (("lower"("email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))));



CREATE POLICY "Users can insert their focus sessions" ON "public"."focus_sessions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "focus_sessions"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert their profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can read their profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their focus sessions" ON "public"."focus_sessions" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "focus_sessions"."workspace_id") AND ("wm"."user_id" = "auth"."uid"())))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "focus_sessions"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update their profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Workspace editors can delete boards" ON "public"."boards" FOR DELETE USING ("app_private"."can_edit_workspace"("workspace_id"));



CREATE POLICY "Workspace editors can delete checklist items" ON "public"."task_checklist_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_checklist_items"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can delete lists" ON "public"."lists" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "lists"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can delete task activities" ON "public"."task_activities" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_activities"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can delete task label links" ON "public"."task_label_links" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
     JOIN "public"."task_labels" "label_row" ON ((("label_row"."id" = "task_label_links"."label_id") AND ("label_row"."board_id" = "board_row"."id"))))
  WHERE (("task_row"."id" = "task_label_links"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can delete task labels" ON "public"."task_labels" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "task_labels"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can delete tasks" ON "public"."tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."lists" "list_row"
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("list_row"."id" = "tasks"."list_id") AND ("board_row"."id" = "tasks"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert boards" ON "public"."boards" FOR INSERT WITH CHECK ("app_private"."can_edit_workspace"("workspace_id"));



CREATE POLICY "Workspace editors can insert checklist items" ON "public"."task_checklist_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_checklist_items"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_checklist_items"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert lists" ON "public"."lists" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "lists"."board_id") AND (NOT ("lists"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert task activities" ON "public"."task_activities" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_activities"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_activities"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("task_activities"."board_id" IS DISTINCT FROM "board_row"."id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert task label links" ON "public"."task_label_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
     JOIN "public"."task_labels" "label_row" ON ((("label_row"."id" = "task_label_links"."label_id") AND ("label_row"."board_id" = "board_row"."id"))))
  WHERE (("task_row"."id" = "task_label_links"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_label_links"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("label_row"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert task labels" ON "public"."task_labels" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "task_labels"."board_id") AND (NOT ("task_labels"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can insert tasks" ON "public"."tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."lists" "list_row"
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("list_row"."id" = "tasks"."list_id") AND ("board_row"."id" = "tasks"."board_id") AND (NOT ("tasks"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("list_row"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update boards" ON "public"."boards" FOR UPDATE USING ("app_private"."can_edit_workspace"("workspace_id")) WITH CHECK ("app_private"."can_edit_workspace"("workspace_id"));



CREATE POLICY "Workspace editors can update checklist items" ON "public"."task_checklist_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_checklist_items"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_checklist_items"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_checklist_items"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update lists" ON "public"."lists" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "lists"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "lists"."board_id") AND (NOT ("lists"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update task activities" ON "public"."task_activities" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_activities"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_activities"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_activities"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("task_activities"."board_id" IS DISTINCT FROM "board_row"."id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update task label links" ON "public"."task_label_links" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
     JOIN "public"."task_labels" "label_row" ON ((("label_row"."id" = "task_label_links"."label_id") AND ("label_row"."board_id" = "board_row"."id"))))
  WHERE (("task_row"."id" = "task_label_links"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
     JOIN "public"."task_labels" "label_row" ON ((("label_row"."id" = "task_label_links"."label_id") AND ("label_row"."board_id" = "board_row"."id"))))
  WHERE (("task_row"."id" = "task_label_links"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND (NOT ("task_label_links"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("label_row"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update task labels" ON "public"."task_labels" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "task_labels"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "task_labels"."board_id") AND (NOT ("task_labels"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update tasks" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."lists" "list_row"
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("list_row"."id" = "tasks"."list_id") AND ("board_row"."id" = "tasks"."board_id") AND "app_private"."can_edit_workspace"("board_row"."workspace_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."lists" "list_row"
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("list_row"."id" = "tasks"."list_id") AND ("board_row"."id" = "tasks"."board_id") AND (NOT ("tasks"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND (NOT ("list_row"."workspace_id" IS DISTINCT FROM "board_row"."workspace_id")) AND "app_private"."can_edit_workspace"("board_row"."workspace_id")))));



CREATE POLICY "Workspace editors can update workspaces" ON "public"."workspaces" FOR UPDATE USING ("app_private"."can_edit_workspace"("id")) WITH CHECK ("app_private"."can_edit_workspace"("id"));



CREATE POLICY "Workspace managers can create invites" ON "public"."workspace_invites" FOR INSERT WITH CHECK ("app_private"."can_manage_workspace_members"("workspace_id"));



CREATE POLICY "Workspace managers can delete invites" ON "public"."workspace_invites" FOR DELETE USING ("app_private"."can_manage_workspace_members"("workspace_id"));



CREATE POLICY "Workspace managers can delete memberships" ON "public"."workspace_members" FOR DELETE USING (("app_private"."can_manage_workspace_members"("workspace_id") AND ("role" <> 'owner'::"text")));



CREATE POLICY "Workspace managers can insert memberships" ON "public"."workspace_members" FOR INSERT WITH CHECK (("app_private"."can_manage_workspace_members"("workspace_id") AND ("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"]))));



CREATE POLICY "Workspace managers can read invites" ON "public"."workspace_invites" FOR SELECT USING ("app_private"."can_manage_workspace_members"("workspace_id"));



CREATE POLICY "Workspace managers can update invites" ON "public"."workspace_invites" FOR UPDATE USING ("app_private"."can_manage_workspace_members"("workspace_id")) WITH CHECK ("app_private"."can_manage_workspace_members"("workspace_id"));



CREATE POLICY "Workspace managers can update memberships" ON "public"."workspace_members" FOR UPDATE USING (("app_private"."can_manage_workspace_members"("workspace_id") AND ("role" <> 'owner'::"text"))) WITH CHECK (("app_private"."can_manage_workspace_members"("workspace_id") AND ("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"]))));



CREATE POLICY "Workspace members can read boards" ON "public"."boards" FOR SELECT USING ("app_private"."is_workspace_member"("workspace_id"));



CREATE POLICY "Workspace members can read checklist items" ON "public"."task_checklist_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_checklist_items"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read focus sessions" ON "public"."focus_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "focus_sessions"."workspace_id") AND ("wm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Workspace members can read lists" ON "public"."lists" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "lists"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read peer profiles" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."workspace_members" "viewer_membership"
     JOIN "public"."workspace_members" "peer_membership" ON (("peer_membership"."workspace_id" = "viewer_membership"."workspace_id")))
  WHERE (("viewer_membership"."user_id" = "auth"."uid"()) AND ("peer_membership"."user_id" = "profiles"."id") AND "app_private"."is_workspace_member"("viewer_membership"."workspace_id"))))));



CREATE POLICY "Workspace members can read task activities" ON "public"."task_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("task_row"."id" = "task_activities"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read task label links" ON "public"."task_label_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."tasks" "task_row"
     JOIN "public"."lists" "list_row" ON (("list_row"."id" = "task_row"."list_id")))
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
     JOIN "public"."task_labels" "label_row" ON ((("label_row"."id" = "task_label_links"."label_id") AND ("label_row"."board_id" = "board_row"."id"))))
  WHERE (("task_row"."id" = "task_label_links"."task_id") AND ("board_row"."id" = "task_row"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read task labels" ON "public"."task_labels" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."boards" "board_row"
  WHERE (("board_row"."id" = "task_labels"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read tasks" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."lists" "list_row"
     JOIN "public"."boards" "board_row" ON (("board_row"."id" = "list_row"."board_id")))
  WHERE (("list_row"."id" = "tasks"."list_id") AND ("board_row"."id" = "tasks"."board_id") AND "app_private"."is_workspace_member"("board_row"."workspace_id")))));



CREATE POLICY "Workspace members can read their memberships" ON "public"."workspace_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "app_private"."is_workspace_member"("workspace_id")));



CREATE POLICY "Workspace members can read workspaces" ON "public"."workspaces" FOR SELECT USING ("app_private"."is_workspace_member"("id"));



ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."focus_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_label_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Workspace editors can delete task covers" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'task-covers'::"text") AND "app_private"."can_edit_workspace"((("storage"."foldername"("name"))[1])::"uuid")));



CREATE POLICY "Workspace editors can update task covers" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'task-covers'::"text") AND "app_private"."can_edit_workspace"((("storage"."foldername"("name"))[1])::"uuid"))) WITH CHECK ((("bucket_id" = 'task-covers'::"text") AND "app_private"."can_edit_workspace"((("storage"."foldername"("name"))[1])::"uuid")));



CREATE POLICY "Workspace editors can upload task covers" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'task-covers'::"text") AND "app_private"."can_edit_workspace"((("storage"."foldername"("name"))[1])::"uuid")));



CREATE POLICY "Workspace members can read task covers" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'task-covers'::"text") AND "app_private"."is_workspace_member"((("storage"."foldername"("name"))[1])::"uuid")));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "app_private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



REVOKE ALL ON FUNCTION "app_private"."can_edit_workspace"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app_private"."can_edit_workspace"("target_workspace_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "app_private"."can_manage_workspace_members"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app_private"."can_manage_workspace_members"("target_workspace_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "app_private"."is_workspace_member"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app_private"."is_workspace_member"("target_workspace_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_workspace_invite"("invite_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_workspace_invite"("invite_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_workspace_invite"("invite_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_edit_workspace"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_edit_workspace"("target_workspace_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_workspace_members"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("target_workspace_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_workspace_with_owner"("workspace_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_workspace_with_owner"("workspace_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workspace_with_owner"("workspace_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_workspace_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_workspace_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_workspace_member_by_email"("target_workspace_id" "uuid", "member_email" "text", "member_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_workspace_member_by_email"("target_workspace_id" "uuid", "member_email" "text", "member_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_workspace_member_by_email"("target_workspace_id" "uuid", "member_email" "text", "member_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_workspace_member"("target_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_workspace_member"("target_workspace_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_board_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_board_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_board_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_list_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_list_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_list_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_activity_workspace_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_activity_workspace_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_activity_workspace_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_child_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_child_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_child_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_label_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_label_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_label_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_task_positions"("task_positions" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_task_positions"("task_positions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_positions"("task_positions" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."focus_sessions" TO "anon";
GRANT ALL ON TABLE "public"."focus_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."lists" TO "anon";
GRANT ALL ON TABLE "public"."lists" TO "authenticated";
GRANT ALL ON TABLE "public"."lists" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."task_activities" TO "anon";
GRANT ALL ON TABLE "public"."task_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activities" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_label_links" TO "anon";
GRANT ALL ON TABLE "public"."task_label_links" TO "authenticated";
GRANT ALL ON TABLE "public"."task_label_links" TO "service_role";



GRANT ALL ON TABLE "public"."task_labels" TO "anon";
GRANT ALL ON TABLE "public"."task_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."task_labels" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_invites" TO "anon";
GRANT ALL ON TABLE "public"."workspace_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_invites" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




