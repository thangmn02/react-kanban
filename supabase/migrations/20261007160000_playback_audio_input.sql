begin;

-- Short-lived captured audio stays private. Only the authenticated gateway
-- and analysis worker hold service-role access; no client Storage policy exists.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('beat-audio-inputs','beat-audio-inputs',false,2080044,array['audio/wav','application/json'])
on conflict(id) do nothing;

-- Preparing live capture must not create a job for audio that has not played.
-- The existing atomic claim function is called only after a bounded input arrives.
create function public.register_beat_demand(p_user uuid,p_demand uuid,p_provider text,p_asset text,p_version text,p_duration double precision,p_start double precision,p_end double precision)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t beat_event_tracks;
begin
  if p_start < 0 or p_end <= p_start or p_end-p_start > 300 or p_end > p_duration or mod(p_start::numeric,30) <> 0
    or p_duration <= 0 or p_duration > 864000 then raise exception 'invalid_range'; end if;
  insert into beat_event_tracks(provider,media_asset_id,analysis_version,duration)
    values(p_provider,p_asset,p_version,p_duration) on conflict do nothing;
  select * into strict t from beat_event_tracks where provider=p_provider and media_asset_id=p_asset and analysis_version=p_version and timeline_id='vod' for update;
  if abs(t.duration-p_duration) > greatest(2,t.duration*.02) then raise exception 'duration_mismatch'; end if;
  if exists(select 1 from beat_analysis_demands where id=p_demand and user_id<>p_user) then raise exception 'invalid_owner'; end if;
  delete from beat_analysis_demands where expires_at<=now();
  if (select count(*) from beat_analysis_demands where user_id=p_user and id<>p_demand)>=8 then raise exception 'demand_limit'; end if;
  insert into beat_analysis_demands(id,user_id,track_id,range_start,range_end,expires_at)
    values(p_demand,p_user,t.id,p_start,p_end,now()+interval '45 seconds')
    on conflict(id) do update set track_id=excluded.track_id,range_start=excluded.range_start,range_end=excluded.range_end,expires_at=excluded.expires_at;
  return t.id;
end $$;
revoke all on function public.register_beat_demand(uuid,uuid,text,text,text,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.register_beat_demand(uuid,uuid,text,text,text,double precision,double precision,double precision) to service_role;

-- Upload admission must never revive demand after the request body was read.
-- Follow the existing track -> demand lock order and reuse chunk deduplication.
create function public.claim_captured_beat_range(p_user uuid,p_demand uuid,p_provider text,p_asset text,p_version text,p_duration double precision,p_start double precision,p_end double precision)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t beat_event_tracks; d beat_analysis_demands; result jsonb;
begin
  select * into t from beat_event_tracks where provider=p_provider and media_asset_id=p_asset and analysis_version=p_version and timeline_id='vod' for update;
  if not found then return null; end if;
  select * into d from beat_analysis_demands where id=p_demand and user_id=p_user and track_id=t.id and expires_at>now() for update;
  if not found or p_start<d.range_start or p_end>d.range_end or p_end-p_start>60 then return null; end if;
  result := claim_beat_range(p_user,p_demand,p_provider,p_asset,p_version,p_duration,p_start,p_end);
  update beat_analysis_demands set range_start=d.range_start,range_end=d.range_end where id=p_demand;
  return result;
end $$;
revoke all on function public.claim_captured_beat_range(uuid,uuid,text,text,text,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.claim_captured_beat_range(uuid,uuid,text,text,text,double precision,double precision,double precision) to service_role;

commit;
