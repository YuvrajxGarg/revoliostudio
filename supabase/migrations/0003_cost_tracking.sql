-- Revolio Studio — estimated spend tracking
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table public.generations
  add column if not exists cost_usd numeric(10, 4);

create index if not exists generations_cost_usd_idx
  on public.generations (cost_usd) where cost_usd is not null;

-- Extend the admin usage view with spend + credit totals.
-- "Credits" here = cost_usd * 20 (a simple, consistent internal unit —
-- purely cosmetic, doesn't correspond to a muapi credit balance).
create or replace view public.admin_user_usage as
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
  coalesce(sum(g.cost_usd), 0) as total_cost_usd,
  coalesce(sum(g.cost_usd) * 20, 0) as total_credits
from public.profiles p
left join public.generations g on g.user_id = p.id
group by p.id;

-- System-wide spend breakdown by model, for the admin billing view.
create or replace view public.admin_spend_by_model as
select
  model_id,
  model_label,
  category,
  count(*) as generations,
  coalesce(sum(cost_usd), 0) as total_cost_usd
from public.generations
where status = 'completed'
group by model_id, model_label, category
order by total_cost_usd desc;
