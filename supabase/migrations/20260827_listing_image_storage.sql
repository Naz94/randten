-- RANDTEN listing image storage
-- Private bucket. Images are only readable when the listing owner is viewing them
-- or when the associated listing has reached published status.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are: <seller_uuid>/<listing_uuid>/<random_filename>
create policy "listing_images_storage_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = (select auth.uid())
      and l.status in ('draft','payment_failed','rejected')
  )
);

create policy "listing_images_storage_select"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'listing-images'
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and (
        l.status = 'published'
        or l.seller_id = (select auth.uid())
      )
  )
);

create policy "listing_images_storage_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = (select auth.uid())
      and l.status in ('draft','payment_failed','rejected')
  )
);
