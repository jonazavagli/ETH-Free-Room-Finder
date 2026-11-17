-- Community Contributions Storage Bucket & Rate-Limit Indexes
-- Creates the public-read `room-photos` bucket (writes strictly via server service_role)
-- and adds device_hash indexes for fast server-side rate-limit lookups.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-photos',
  'room-photos',
  true,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can view room photos'
  ) then
    create policy "Public can view room photos"
      on storage.objects for select
      to public
      using (bucket_id = 'room-photos');
  end if;
end
$$;

-- Indexes for fast server-side device_hash rate-limit checks
create index if not exists idx_lock_reports_device_time
  on public.lock_reports(device_hash, reported_at desc);

create index if not exists idx_detail_reports_device_time
  on public.detail_reports(device_hash, reported_at desc);

create index if not exists idx_photos_device_time
  on public.photos(device_hash, uploaded_at desc);
