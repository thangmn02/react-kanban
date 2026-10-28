export const authorizedProject = 'enzzyuhchizfmruxhfhg';
export const postgresImage = 'postgres@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe';
export const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`;
// Deliberately exclude application schemas: the migration rehearsal changes them.
export const platformFingerprintSql = `select md5(coalesce(string_agg(identity||':'||definition,E'\\n' order by identity collate "C"),'')) from (
select 'column:'||n.nspname||'.'||c.relname||'.'||a.attname as identity,
 format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') as definition
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 where n.nspname in ('auth','storage') and a.attnum>0 and not a.attisdropped and c.relkind in ('r','p')
union all select 'function:'||n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','storage') and p.prokind in ('f','p')
union all select 'constraint:'||n.nspname||'.'||c.relname||'.'||k.conname,pg_get_constraintdef(k.oid) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage')
union all select 'index:'||n.nspname||'.'||c.relname,pg_get_indexdef(c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','storage') and c.relkind='i'
) definitions`;
export const platformVersionsSql = `select jsonb_build_object('auth',(select md5(coalesce(string_agg(to_jsonb(m)::text,E'\\n' order by to_jsonb(m)::text collate "C"),'')) from auth.schema_migrations m),'storage',(select md5(coalesce(string_agg(to_jsonb(m)::text,E'\\n' order by to_jsonb(m)::text collate "C"),'')) from storage.migrations m))`;
export const countsSqlFor = keys => keys.map(key => { const [schema, table] = key.split('.'); if (!schema || !table || key.split('.').length !== 2) throw Error('Invalid backed-up table identity'); return `select '${key.replaceAll("'", "''")}' as name,count(*)::bigint as count from ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`; }).join(' union all ');
