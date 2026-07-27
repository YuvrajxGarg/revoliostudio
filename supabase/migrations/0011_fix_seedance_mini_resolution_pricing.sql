-- Data fix: seedance-2-mini-i2v's real per-second rate depends on the
-- selected resolution (muapi.ai/seedance-2: "$0.08-$0.15/sec" across
-- "480p-720p" — 0.08 is the 480p rate, 0.15 is the 720p rate). Our
-- estimator used to apply a flat 0.08/sec regardless of resolution, so any
-- generation submitted at 720p was under-priced in cost_usd relative to
-- what muapi actually charges. Recompute cost_usd for every row of this
-- model from its own stored settings (resolution + duration) rather than
-- a single flat correction, since both vary per generation.
update public.generations
set cost_usd = round(
  (
    case
      when (settings ->> 'resolution') = '720p' then 0.15
      else 0.08
    end
  )::numeric * coalesce((settings ->> 'duration')::numeric, 5),
  3
)
where model_id = 'seedance-2-mini-i2v';
