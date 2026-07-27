-- Data fix: gpt-image-2 is resolution-tiered, confirmed live against
-- muapi's authenticated estimate-cost endpoint (real API key, live call):
-- $0.06 @ 1K, $0.09 @ 2K (default), $0.15 @ 4K — all at the "high" quality
-- tier muapi defaults to (our payload never submits a separate quality
-- field, so this is what's actually billed today). Our estimator hardcoded
-- a flat $0.09 regardless of resolution, so any 4K generation was
-- understated and any 1K generation was overstated. Recompute cost_usd for
-- every row of this model from its own stored settings (resolution +
-- numImages) rather than a single flat correction. Rows with no recorded
-- resolution (older generations, before this field was tracked, or the
-- edit endpoint which shares the same cost table) are left at the 2K rate,
-- matching muapi's own schema default.
update public.generations
set cost_usd = round(
  (
    case
      when (settings ->> 'resolution') in ('1K', '1k') then 0.06
      when (settings ->> 'resolution') in ('4K', '4k') then 0.15
      else 0.09
    end
  )::numeric * greatest(1, coalesce((settings ->> 'numImages')::numeric, 1)),
  3
)
where model_id in ('gpt-image-2', 'gpt-image-2-edit');
