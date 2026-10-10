begin;

-- All access goes through the authenticated gateway/worker. No client role may
-- read demand ownership, job inputs or private Storage object paths directly.
create table public.beat_event_tracks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('youtube','soundcloud','spotify','apple','deezer','tidal')),
  media_asset_id text not null check (length(media_asset_id) between 1 and 200),
  analysis_version text not null check (length(analysis_version) between 1 and 100),
  timeline_id text not null default 'vod' check (timeline_id = 'vod'),
  schema_version integer not null default 2 check (schema_version = 2),
  duration double precision not null check (duration > 0 and duration <= 864000),
  lead_decision jsonb,
  lead_decision_time double precision not null default -1,
  unique_uncached_audio_seconds_analyzed double precision not null default 0,
  created_at timestamptz not null default now(),
  unique(provider, media_asset_id, analysis_version, timeline_id)
);
create table public.beat_analysis_demands (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.beat_event_tracks(id) on delete cascade,
  range_start double precision not null,
  range_end double precision not null,
  expires_at timestamptz not null,
  check (range_start >= 0 and mod(range_start::numeric,30) = 0 and range_end > range_start and range_end-range_start <= 600)
);
create index beat_demands_active on public.beat_analysis_demands(track_id,expires_at);
create table public.beat_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.beat_event_tracks(id) on delete cascade,
  range_start double precision not null,
  range_end double precision not null,
  state text not null default 'pending' check (state in ('pending','queued','running','completed','failed','input_unavailable','cancelled')),
  call_id text,
  lease_until timestamptz not null default now() + interval '90 seconds',
  retry_after timestamptz,
  runtime_seconds double precision,
  context_audio_seconds double precision,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (range_start >= 0 and mod(range_start::numeric,30) = 0 and range_end > range_start and range_end-range_start <= 300)
);
create index beat_jobs_track on public.beat_analysis_jobs(track_id,state,lease_until);
create table public.beat_event_chunks (
  track_id uuid not null references public.beat_event_tracks(id) on delete cascade,
  chunk_index integer not null check (chunk_index between 0 and 28799),
  job_id uuid not null references public.beat_analysis_jobs(id),
  state text not null default 'pending' check (state in ('pending','ready')),
  revision text check (revision ~ '^[a-f0-9]{64}$'),
  object_path text,
  event_count integer check (event_count between 0 and 4096),
  payload_bytes integer check (payload_bytes between 1 and 524288),
  published_at timestamptz,
  primary key(track_id,chunk_index),
  check (state <> 'ready' or (revision is not null and object_path is not null and event_count is not null and payload_bytes is not null))
);

alter table public.beat_event_tracks enable row level security;
alter table public.beat_analysis_demands enable row level security;
alter table public.beat_analysis_jobs enable row level security;
alter table public.beat_event_chunks enable row level security;
revoke all on public.beat_event_tracks,public.beat_analysis_demands,public.beat_analysis_jobs,public.beat_event_chunks from anon,authenticated;
grant all on public.beat_event_tracks,public.beat_analysis_demands,public.beat_analysis_jobs,public.beat_event_chunks to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('beat-event-tracks','beat-event-tracks',false,524288,array['application/json'])
on conflict(id) do nothing;

create function public.claim_beat_range(p_user uuid,p_demand uuid,p_provider text,p_asset text,p_version text,p_duration double precision,p_start double precision,p_end double precision)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare t beat_event_tracks; j beat_analysis_jobs; i integer; first_missing integer; last_index integer; output jsonb := '[]';
begin
  if p_start < 0 or p_end <= p_start or p_end-p_start > 300 or p_end > p_duration or mod(p_start::numeric,30) <> 0
    or p_duration <= 0 or p_duration > 864000 then raise exception 'invalid_range'; end if;
  insert into beat_event_tracks(provider,media_asset_id,analysis_version,duration)
    values(p_provider,p_asset,p_version,p_duration) on conflict do nothing;
  select * into strict t from beat_event_tracks where provider=p_provider and media_asset_id=p_asset and analysis_version=p_version and timeline_id='vod' for update;
  if abs(t.duration-p_duration) > greatest(2,t.duration*.02) then raise exception 'duration_mismatch'; end if;
  if exists(select 1 from beat_analysis_demands where id=p_demand and user_id<>p_user) then raise exception 'invalid_owner'; end if;
  delete from beat_analysis_demands where expires_at <= now();
  if (select count(*) from beat_analysis_demands where user_id=p_user and id<>p_demand) >= 8 then raise exception 'demand_limit'; end if;
  insert into beat_analysis_demands(id,user_id,track_id,range_start,range_end,expires_at)
    values(p_demand,p_user,t.id,p_start,p_end,now()+interval '45 seconds')
    on conflict(id) do update set track_id=excluded.track_id,range_start=excluded.range_start,range_end=excluded.range_end,expires_at=excluded.expires_at;
  update beat_analysis_jobs set state='cancelled',failure_code='demand_expired'
    where track_id=t.id and state in ('pending','queued','running') and (lease_until<=now() or state<>'running' and not exists
      (select 1 from beat_analysis_demands d where d.track_id=t.id and d.expires_at>now() and d.range_start<beat_analysis_jobs.range_end and d.range_end>beat_analysis_jobs.range_start));
  delete from beat_event_chunks c using beat_analysis_jobs b where c.track_id=t.id and c.job_id=b.id and c.state='pending'
    and b.state in ('cancelled','failed','input_unavailable') and (b.retry_after is null or b.retry_after<=now());
  last_index := ceil(p_end/30)::integer-1;
  -- A sentinel closes each contiguous run. Chunk ownership under this track
  -- lock deduplicates partially overlapping users and ranges, not only exact jobs.
  for i in (p_start/30)::integer..last_index+1 loop
    if i<=last_index and not exists(select 1 from beat_event_chunks where track_id=t.id and chunk_index=i) then
      if first_missing is null then first_missing:=i; end if;
    elsif first_missing is not null then
      insert into beat_analysis_jobs(track_id,range_start,range_end) values(t.id,first_missing*30,least(i*30,t.duration)) returning * into j;
      insert into beat_event_chunks(track_id,chunk_index,job_id) select t.id,x,j.id from generate_series(first_missing,i-1) x;
      output:=output || jsonb_build_array(jsonb_build_object('jobId',j.id,'start',j.range_start,'end',j.range_end));
      first_missing:=null;
    end if;
  end loop;
  return jsonb_build_object('trackId',t.id,'jobs',output);
end $$;

create function public.start_beat_job(p_job uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j beat_analysis_jobs; t beat_event_tracks;
begin
  select * into j from beat_analysis_jobs where id=p_job for update;
  if not found or j.state not in ('pending','queued') or j.lease_until<=now() then return null; end if;
  if not exists(select 1 from beat_analysis_demands where track_id=j.track_id and expires_at>now() and range_start<j.range_end and range_end>j.range_start) then
    update beat_analysis_jobs set state='cancelled',failure_code='demand_expired' where id=p_job; return null;
  end if;
  update beat_analysis_jobs set state='running',lease_until=now()+interval '15 minutes' where id=p_job;
  select * into strict t from beat_event_tracks where id=j.track_id;
  return jsonb_build_object('jobId',j.id,'trackId',t.id,'asset',jsonb_build_object('provider',t.provider,'id',t.media_asset_id),'analysisVersion',t.analysis_version,
    'duration',t.duration,'requestedRange',jsonb_build_object('start',j.range_start,'end',j.range_end),'leadDecision',t.lead_decision);
end $$;

create function public.publish_beat_range(p_job uuid,p_chunks jsonb,p_runtime double precision,p_context double precision,p_lead jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare j beat_analysis_jobs; n integer; item jsonb; expected integer;
begin
  select * into j from beat_analysis_jobs where id=p_job for update;
  if not found or j.state<>'running' or j.lease_until<=now() then return false; end if;
  expected:=ceil(j.range_end/30)::integer-(j.range_start/30)::integer;
  if jsonb_typeof(p_chunks)<>'array' or jsonb_array_length(p_chunks)<>expected then raise exception 'incomplete_range'; end if;
  n:=0;
  for item in select value from jsonb_array_elements(p_chunks) loop
    if item->>'path' <> (j.track_id::text || '/' || p_job::text || '/' || (item->>'revision') || '.json') then raise exception 'invalid_path'; end if;
    update beat_event_chunks set state='ready',revision=item->>'revision',object_path=item->>'path',event_count=(item->>'count')::integer,
      payload_bytes=(item->>'bytes')::integer,published_at=now()
      where track_id=j.track_id and job_id=p_job and state='pending' and chunk_index=(item->>'index')::integer;
    if not found then raise exception 'invalid_chunk_owner'; end if;
    n:=n+1;
  end loop;
  update beat_analysis_jobs set state='completed',completed_at=now(),runtime_seconds=p_runtime,context_audio_seconds=p_context where id=p_job;
  update beat_event_tracks set unique_uncached_audio_seconds_analyzed=unique_uncached_audio_seconds_analyzed+j.range_end-j.range_start,
    lead_decision=case when j.range_start>=lead_decision_time then p_lead else lead_decision end,
    lead_decision_time=greatest(lead_decision_time,j.range_start) where id=j.track_id;
  return true;
end $$;

revoke all on function public.claim_beat_range(uuid,uuid,text,text,text,double precision,double precision,double precision),
  public.start_beat_job(uuid),public.publish_beat_range(uuid,jsonb,double precision,double precision,jsonb) from public,anon,authenticated;
grant execute on function public.claim_beat_range(uuid,uuid,text,text,text,double precision,double precision,double precision),
  public.start_beat_job(uuid),public.publish_beat_range(uuid,jsonb,double precision,double precision,jsonb) to service_role;
commit;
