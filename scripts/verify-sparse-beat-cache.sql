-- Run inside a rollback transaction after the focused migration.
do $$
declare u uuid; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  first_claim jsonb; overlapping jsonb; seek_claim jsonb; track uuid; job uuid; result jsonb;
begin
  select id into u from auth.users limit 1;
  if u is null then raise exception 'An existing authenticated owner is required'; end if;
  first_claim:=public.claim_beat_range(u,a,'youtube','range-test1','server-colab-range-v1',7200,2040,2340);
  track:=(first_claim->>'trackId')::uuid;
  if jsonb_array_length(first_claim->'jobs')<>1 or (select count(*) from public.beat_event_chunks where track_id=track)<>10 then raise exception 'First range not bounded'; end if;
  overlapping:=public.claim_beat_range(u,b,'youtube','range-test1','server-colab-range-v1',7200,2190,2490);
  if jsonb_array_length(overlapping->'jobs')<>1 or (overlapping->'jobs'->0->>'start')::numeric<>2340 then raise exception 'Overlapping range was duplicated'; end if;
  seek_claim:=public.claim_beat_range(u,c,'youtube','range-test1','server-colab-range-v1',7200,4980,5280);
  if (seek_claim->'jobs'->0->>'start')::numeric<>4980 or (select count(*) from public.beat_event_chunks where track_id=track)<>25 then raise exception 'Seek analyzed skipped audio'; end if;
  job:=(first_claim->'jobs'->0->>'jobId')::uuid;
  result:=public.start_beat_job(job);
  if result is null or public.start_beat_job(job) is not null then raise exception 'Worker ownership is not exclusive'; end if;
  begin
    perform public.publish_beat_range(job,'[]',1,310,'{}');
    raise exception 'Incomplete range published';
  exception when others then
    if sqlerrm<>'incomplete_range' then raise; end if;
  end;
  if exists(select 1 from public.beat_event_chunks where track_id=track and state='ready') then raise exception 'Failed publication exposed partial coverage'; end if;
  delete from public.beat_analysis_demands where track_id=track;
  job:=(seek_claim->'jobs'->0->>'jobId')::uuid;
  if public.start_beat_job(job) is not null then raise exception 'Worker ran without demand'; end if;
  if has_table_privilege('authenticated','public.beat_analysis_jobs','select') or has_function_privilege('authenticated',
    'public.claim_beat_range(uuid,uuid,text,text,text,double precision,double precision,double precision)','execute') then raise exception 'Client may bypass gateway'; end if;
end $$;
