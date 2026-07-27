-- Data fix: kling-o1-video-edit's cost estimate was wrong (1.09 instead of
-- the real 0.654 muapi charges — confirmed against the user's own muapi
-- billing dashboard). The app-side constant is fixed in src/lib/pricing.ts,
-- but that only affects generations created going forward. This backfills
-- every already-stored row for this model so admin/usage spend totals
-- reflect what was actually billed.
update public.generations
set cost_usd = 0.654
where model_id = 'kling-o1-video-edit'
  and cost_usd = 1.09;
