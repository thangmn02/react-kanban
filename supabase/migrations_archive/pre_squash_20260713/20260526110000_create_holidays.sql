create table if not exists public.holidays (
  id text primary key,
  name text not null,
  date date not null,
  country_code text not null default 'VN',
  created_at timestamptz not null default now()
);

create index if not exists holidays_country_code_date_idx
  on public.holidays (country_code, date);

alter table public.holidays enable row level security;

drop policy if exists "Allow public read holidays" on public.holidays;
create policy "Allow public read holidays"
on public.holidays
for select
using (true);

grant select on public.holidays to anon, authenticated;

insert into public.holidays (id, name, date, country_code)
values
  ('vn-2026-01-01', 'Tet Duong lich', '2026-01-01', 'VN'),
  ('vn-2026-02-16', 'Tet Nguyen dan', '2026-02-16', 'VN'),
  ('vn-2026-02-17', 'Tet Nguyen dan', '2026-02-17', 'VN'),
  ('vn-2026-02-18', 'Tet Nguyen dan', '2026-02-18', 'VN'),
  ('vn-2026-04-26', 'Gio To Hung Vuong', '2026-04-26', 'VN'),
  ('vn-2026-04-30', 'Ngay Giai phong mien Nam', '2026-04-30', 'VN'),
  ('vn-2026-05-01', 'Quoc te Lao dong', '2026-05-01', 'VN'),
  ('vn-2026-09-02', 'Quoc khanh Viet Nam', '2026-09-02', 'VN')
on conflict (id) do update
set
  name = excluded.name,
  date = excluded.date,
  country_code = excluded.country_code;
