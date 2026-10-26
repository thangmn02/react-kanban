-- Back up the target database before applying. No profile data is rewritten.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kora-profile-images','kora-profile-images',false,524288,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "kora_profile_images_insert_own" on storage.objects for insert to authenticated
with check(bucket_id='kora-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "kora_profile_images_update_own" on storage.objects for update to authenticated
using(bucket_id='kora-profile-images' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='kora-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "kora_profile_images_delete_own" on storage.objects for delete to authenticated
using(bucket_id='kora-profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "kora_profile_images_read_identity" on storage.objects for select to authenticated
using(bucket_id='kora-profile-images' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or exists(select 1 from public.profiles p
    join public.workspace_members owner_member on owner_member.user_id=p.id
    join public.workspace_members viewer_member on viewer_member.workspace_id=owner_member.workspace_id
    where p.id::text=(storage.foldername(name))[1]
      and p.avatar_url='kora-profile-images/'||name and viewer_member.user_id=auth.uid())
));
