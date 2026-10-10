begin;

-- Development projects only; deliberately excluded from normal migrations.
-- Gateway admission additionally requires development access and an exact
-- operator-authorized content hash. No browser role receives table access.
alter table public.beat_event_tracks drop constraint beat_event_tracks_provider_check;
alter table public.beat_event_tracks add constraint beat_event_tracks_provider_check
  check (provider in ('youtube','soundcloud','spotify','apple','deezer','tidal','kora-development'));
alter table public.beat_event_tracks add constraint beat_event_tracks_development_asset_check
  check (provider <> 'kora-development' or media_asset_id ~ '^[a-f0-9]{64}$');

commit;
