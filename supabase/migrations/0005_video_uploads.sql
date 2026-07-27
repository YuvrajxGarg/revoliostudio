-- Revolio Studio — allow larger video uploads (Edit Video / Motion Control
-- reference clips) in the 'media' storage bucket.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

update storage.buckets
set file_size_limit = 200 * 1024 * 1024
where id = 'media';
