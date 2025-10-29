-- Make generated-images bucket public and add policies
update storage.buckets set public = true where id = 'generated-images';

-- Allow public read access to generated images
create policy "Public can view generated images"
on storage.objects for select
using (bucket_id = 'generated-images');

-- Allow users to upload their own generated images using folder convention: <user_id>/...
create policy "Users can upload their own generated images"
on storage.objects for insert
with check (
  bucket_id = 'generated-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own generated images
create policy "Users can update their own generated images"
on storage.objects for update
using (
  bucket_id = 'generated-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
