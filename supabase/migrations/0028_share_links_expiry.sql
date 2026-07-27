-- Revolio Studio — expiring public share links. A copy of the shared media
-- is stored in our own Supabase Storage (so the public link doesn't depend on
-- the muapi CDN), and the link expires 24h after creation. Run in the
-- Supabase SQL editor (or `supabase db push`). Assumes 0027 already ran.

-- ── share link: expiry + stored copy ────────────────────────────────────
alter table public.generation_share_links
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');
alter table public.generation_share_links
  add column if not exists storage_path text;   -- path inside the "media" bucket, for cleanup
alter table public.generation_share_links
  add column if not exists shared_url text;      -- public URL of our stored copy

create index if not exists generation_share_links_expiry_idx
  on public.generation_share_links (expires_at);

-- Public read of a shared generation by token — now returns a JSON blob that
-- includes our stored copy URL (`shared_url`) so the public page can serve it
-- instead of the origin CDN, and enforces the 24h expiry (an expired token
-- returns nothing even before the row is physically deleted).
--
-- 0027 created this returning `generations`; Postgres won't let CREATE OR
-- REPLACE change a function's return type, so drop the old one first.
drop function if exists public.get_shared_generation(text);
create or replace function public.get_shared_generation(share_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(g)
         || jsonb_build_object('shared_url', l.shared_url, 'expires_at', l.expires_at)
  from public.generations g
  join public.generation_share_links l on l.generation_id = g.id
  where l.token = share_token
    and g.deleted_at is null
    and l.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_shared_generation(text) to anon, authenticated;

-- ── cleanup ─────────────────────────────────────────────────────────────
-- Delete expired link rows. (Deleting the copied storage object is best done
-- from a scheduled Edge Function with the service role — `storage_path` is
-- kept on the row precisely so that function knows what to remove. Dropping
-- the row alone already makes the link dead, since the RPC filters on
-- expires_at and joins on the token.)
create or replace function public.delete_expired_share_links()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.generation_share_links where expires_at <= now();
$$;

-- Schedule hourly cleanup via pg_cron if the extension is installed. Guarded
-- so this migration still applies on projects without pg_cron enabled.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'revolio-expire-share-links',
      '0 * * * *',
      $cron$ select public.delete_expired_share_links(); $cron$
    );
  end if;
exception when others then
  -- Never let scheduling failure block the migration.
  null;
end;
$$;
