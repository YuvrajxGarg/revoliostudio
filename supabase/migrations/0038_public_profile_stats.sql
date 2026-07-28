-- 0038_public_profile_stats.sql
-- Revolio Studio — public profile stats: streaks, model diversity, and a
-- daily activity map for the /u/[username] contribution graph. Counts ALL
-- of a user's generations (not just published ones) — same convention as
-- GitHub's contribution calendar counting private-repo commits: activity
-- volume is shown, never content (no prompts, images, or model names tied
-- to a specific day). Run in the Supabase SQL editor (or `supabase db push`).

create or replace function public.get_public_profile_stats(p_user_id uuid)
returns table (
  total_generations bigint,
  active_days bigint,
  current_streak int,
  longest_streak int,
  distinct_models bigint,
  favorite_model_label text,
  daily_counts jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  with days as (
    select (created_at at time zone 'utc')::date as day, count(*) as cnt
    from public.generations
    where user_id = p_user_id
    group by 1
  ),
  -- "islands and gaps": consecutive days share day - row_number(), giving one
  -- group per run of unbroken days.
  islands as (
    select day, day - (row_number() over (order by day))::int as grp
    from days
  ),
  streaks as (
    select count(*) as len, max(day) as end_day
    from islands
    group by grp
  ),
  today as (
    select (now() at time zone 'utc')::date as d
  ),
  model_counts as (
    select model_label, count(*) as cnt
    from public.generations
    where user_id = p_user_id
    group by model_label
    order by cnt desc
    limit 1
  ),
  recent_days as (
    select day, cnt from days where day >= (select d from today) - 370
  )
  select
    coalesce((select sum(cnt) from days), 0)::bigint as total_generations,
    (select count(*) from days)::bigint as active_days,
    -- alive if the most recent active-day streak ends today or yesterday
    coalesce(
      (select len from streaks where end_day >= (select d - 1 from today) order by end_day desc limit 1),
      0
    ) as current_streak,
    coalesce((select max(len) from streaks), 0) as longest_streak,
    (select count(distinct model_id) from public.generations where user_id = p_user_id)::bigint as distinct_models,
    (select model_label from model_counts) as favorite_model_label,
    coalesce((select jsonb_object_agg(day::text, cnt) from recent_days), '{}'::jsonb) as daily_counts;
$$;

revoke all on function public.get_public_profile_stats(uuid) from public;
grant execute on function public.get_public_profile_stats(uuid) to anon, authenticated;
