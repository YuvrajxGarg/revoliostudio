-- Data fix: seedream-5-pro and seedream-5-pro-edit are not flat-priced —
-- muapi.ai/seedream states directly: "$0.045/image at 1K resolution, or
-- $0.09/image at 2K resolution". Our estimator hardcoded the 1K rate
-- regardless of what the user picked, so any 2K generation was stored at
-- half its real cost. Recompute cost_usd for every row of these two models
-- from the stored settings (resolution + numImages) rather than a single
-- flat correction, since both vary per generation. Rows with no recorded
-- resolution (older generations, before this field was tracked) are left
-- at the 1K rate, matching the UI's default/lowest tier.
update public.generations
set cost_usd = round(
  (
    case
      when (settings ->> 'resolution') in ('2K', '2k') then 0.09
      else 0.045
    end
  )::numeric * greatest(1, coalesce((settings ->> 'numImages')::numeric, 1)),
  3
)
where model_id in ('seedream-5-pro', 'seedream-5-pro-edit');
