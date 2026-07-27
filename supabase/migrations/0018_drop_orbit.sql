-- Revolio Studio — remove Orbit (real-time infinite canvas)
-- Run this in the Supabase SQL editor if you previously ran
-- 0016_orbit_canvas.sql / 0017_orbit_draw_type.sql — the feature and all
-- its frontend code have been removed, this cleans up the leftover schema.
--
-- Safe to run even if Orbit was never set up (every statement is a
-- guarded/`if exists` drop).

-- Realtime publication entries — drop before the tables so there's nothing
-- left referencing them.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_boards'
  ) then
    alter publication supabase_realtime drop table public.orbit_boards;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_nodes'
  ) then
    alter publication supabase_realtime drop table public.orbit_nodes;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_edges'
  ) then
    alter publication supabase_realtime drop table public.orbit_edges;
  end if;
end $$;

-- Tables (cascade drops their own policies, indexes, and triggers automatically).
drop table if exists public.orbit_edges;
drop table if exists public.orbit_nodes;
drop table if exists public.orbit_board_members;
drop table if exists public.orbit_boards;

-- Functions.
drop function if exists public.orbit_join_board(uuid);
drop function if exists public.orbit_seed_owner_membership();
drop function if exists public.is_orbit_board_member(uuid);
