-- Sets an explicit per-file size cap on the "media" bucket matching what the
-- app now enforces client-side (50MB — Supabase's own free-plan ceiling), so
-- a bypassed/modified client still gets rejected consistently rather than
-- relying purely on client-side trust.
update storage.buckets
set file_size_limit = 52428800 -- 50MB in bytes
where id = 'media';

-- Storage usage helpers for the scheduled cleanup cron
-- (/api/cron/storage-cleanup). storage.objects isn't exposed over PostgREST
-- by default, so these SECURITY DEFINER functions in the public schema let
-- the service-role client query/aggregate it via RPC without needing direct
-- schema access.

create or replace function public.media_storage_usage_bytes()
returns bigint
language sql
security definer
set search_path = storage, public
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
  from storage.objects
  where bucket_id = 'media';
$$;

-- Returns the oldest N objects in the media bucket (path + size), used by
-- the cleanup job to delete the least-recently-uploaded files first when
-- usage crosses the alert threshold.
create or replace function public.oldest_media_objects(result_limit int)
returns table (name text, size bigint)
language sql
security definer
set search_path = storage, public
as $$
  select name, coalesce((metadata->>'size')::bigint, 0) as size
  from storage.objects
  where bucket_id = 'media'
  order by created_at asc
  limit result_limit;
$$;

revoke all on function public.media_storage_usage_bytes() from public;
revoke all on function public.oldest_media_objects(int) from public;
grant execute on function public.media_storage_usage_bytes() to service_role;
grant execute on function public.oldest_media_objects(int) to service_role;
