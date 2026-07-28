-- 0040_public_profile_stats_hourly.sql
-- Revolio Studio — adds an hourly activity histogram to
-- get_public_profile_stats (0039) so the profile page can render a 24-hour
-- radial activity dial instead of a single "peak hour" number, and shift
-- the buckets into the viewer's own timezone client-side. Same privacy
-- stance as 0038/0039: aggregate counts only.

drop function if exists public.get_public_profile_stats(uuid);

create or replace function public.get_public_profile_stats(p_user_id uuid)
returns table (
  total_generations bigint,
  active_days bigint,
  current_streak int,
  longest_streak int,
  distinct_models bigint,
  favorite_model_label text,
  image_count bigint,
  video_count bigint,
  model3d_count bigint,
  peak_hour_utc int,
  hourly_counts jsonb,
  daily_counts jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  with days as (
    select
      (created_at at time zone 'utc')::date as day,
      count(*) as cnt,
      count(*) filter (where category = 'image') as image_cnt,
      count(*) filter (where category = 'video') as video_cnt,
      count(*) filter (where category = '3d') as model3d_cnt
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
  hours as (
    select extract(hour from created_at at time zone 'utc')::int as h, count(*) as cnt
    from public.generations
    where user_id = p_user_id
    group by 1
  ),
  recent_days as (
    select day, cnt, image_cnt, video_cnt, model3d_cnt
    from days
    where day >= (select d from today) - 370
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
    coalesce((select sum(image_cnt) from days), 0)::bigint as image_count,
    coalesce((select sum(video_cnt) from days), 0)::bigint as video_count,
    coalesce((select sum(model3d_cnt) from days), 0)::bigint as model3d_count,
    (select h from hours order by cnt desc, h asc limit 1) as peak_hour_utc,
    coalesce((select jsonb_object_agg(h::text, cnt) from hours), '{}'::jsonb) as hourly_counts,
    coalesce(
      (
        select jsonb_object_agg(
          day::text,
          jsonb_build_object('total', cnt, 'image', image_cnt, 'video', video_cnt, '3d', model3d_cnt)
        )
        from recent_days
      ),
      '{}'::jsonb
    ) as daily_counts;
$$;

revoke all on function public.get_public_profile_stats(uuid) from public;
grant execute on function public.get_public_profile_stats(uuid) to anon, authenticated;
