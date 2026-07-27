-- Revolio Studio — drop the cosmetic "credits" unit (cost_usd * 20)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- This unit was purely cosmetic (see 0003_cost_tracking.sql) and never
-- corresponded to muapi's real credit balance. Showing "1.2 credits" next
-- to a "$0.06" cost with no explained conversion confused users, so every
-- surface now just shows the real dollar amount instead. total_cost_usd
-- already exists on this view and is the only figure downstream code needs.

-- Postgres won't let CREATE OR REPLACE VIEW remove a column (even a
-- trailing one) — it has to be dropped and recreated outright.
drop view if exists public.admin_user_usage;

create view public.admin_user_usage as
select
  p.id as user_id,
  p.email,
  p.display_name,
  p.avatar_url,
  p.is_admin,
  p.created_at as joined_at,
  count(g.id) as total_generations,
  count(g.id) filter (where g.category = 'image') as image_generations,
  count(g.id) filter (where g.category = 'video') as video_generations,
  count(g.id) filter (where g.category = '3d') as model_3d_generations,
  count(g.id) filter (where g.status = 'failed') as failed_generations,
  max(g.created_at) as last_generation_at,
  coalesce(sum(g.cost_usd), 0) as total_cost_usd
from public.profiles p
left join public.generations g on g.user_id = p.id
group by p.id;
