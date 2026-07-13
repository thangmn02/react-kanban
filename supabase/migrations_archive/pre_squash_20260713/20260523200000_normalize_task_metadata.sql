do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'archived_at'
  ) then
    alter table public.tasks
      add column archived_at timestamptz null;
  end if;
end $$;

create table if not exists public.task_checklist_items (
  id text primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index if not exists task_checklist_items_task_id_position_idx
  on public.task_checklist_items (task_id, position);

create table if not exists public.task_labels (
  id text primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint task_labels_board_id_name_key unique (board_id, name)
);

create index if not exists task_labels_board_id_idx
  on public.task_labels (board_id);

create table if not exists public.task_label_links (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id text not null references public.task_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id)
);

create index if not exists task_label_links_task_id_idx
  on public.task_label_links (task_id);

create index if not exists task_label_links_label_id_idx
  on public.task_label_links (label_id);

insert into public.task_checklist_items (id, task_id, content, is_done, position)
select
  coalesce(nullif(item.value->>'id', ''), 'checklist-' || task_row.id::text || '-' || item.ordinality::text) as id,
  task_row.id,
  coalesce(nullif(item.value->>'text', ''), 'Checklist item'),
  coalesce((item.value->>'isDone')::boolean, false),
  item.ordinality - 1
from public.tasks task_row
cross join lateral jsonb_array_elements(coalesce(task_row.checklist_items, '[]'::jsonb)) with ordinality as item(value, ordinality)
on conflict (id) do update
set
  content = excluded.content,
  is_done = excluded.is_done,
  position = excluded.position;

insert into public.task_labels (id, board_id, name, color)
select distinct on (task_row.board_id, lower(coalesce(label.value->>'name', '')))
  coalesce(nullif(label.value->>'id', ''), 'label-' || task_row.board_id::text || '-' || md5(lower(coalesce(label.value->>'name', 'untitled')))) as id,
  task_row.board_id,
  coalesce(nullif(label.value->>'name', ''), 'Untitled'),
  coalesce(nullif(label.value->>'color', ''), 'slate')
from public.tasks task_row
cross join lateral jsonb_array_elements(coalesce(task_row.labels, '[]'::jsonb)) as label(value)
where coalesce(nullif(label.value->>'name', ''), '') <> ''
on conflict (board_id, name) do update
set
  color = excluded.color,
  updated_at = now();

insert into public.task_label_links (task_id, label_id)
select
  task_row.id,
  label_row.id
from public.tasks task_row
cross join lateral jsonb_array_elements(coalesce(task_row.labels, '[]'::jsonb)) as label(value)
join public.task_labels label_row
  on label_row.board_id = task_row.board_id
 and label_row.name = coalesce(nullif(label.value->>'name', ''), 'Untitled')
on conflict (task_id, label_id) do nothing;

alter table public.task_checklist_items enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;

drop policy if exists "Allow all public actions on task_checklist_items" on public.task_checklist_items;
create policy "Allow all public actions on task_checklist_items"
on public.task_checklist_items
for all
using (true)
with check (true);

drop policy if exists "Allow all public actions on task_labels" on public.task_labels;
create policy "Allow all public actions on task_labels"
on public.task_labels
for all
using (true)
with check (true);

drop policy if exists "Allow all public actions on task_label_links" on public.task_label_links;
create policy "Allow all public actions on task_label_links"
on public.task_label_links
for all
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_checklist_items'
  ) then
    alter publication supabase_realtime add table public.task_checklist_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_labels'
  ) then
    alter publication supabase_realtime add table public.task_labels;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_label_links'
  ) then
    alter publication supabase_realtime add table public.task_label_links;
  end if;
end $$;

alter table public.task_checklist_items replica identity full;
alter table public.task_labels replica identity full;
alter table public.task_label_links replica identity full;

alter table public.tasks
  drop column if exists checklist_items,
  drop column if exists labels;
