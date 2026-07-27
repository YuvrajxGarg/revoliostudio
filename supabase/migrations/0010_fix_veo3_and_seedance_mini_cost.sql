-- Data fix: two more model costs were wrong in src/lib/pricing.ts, found via
-- a live audit against muapi.ai's own pricing pages.
--
-- 1. Veo 3 (veo3, veo3-i2v) was a flat $2.50/video — muapi.ai/veo3 states
--    "~$0.50/video" directly, so this was a 5x overcharge. Backfill any row
--    still holding the old flat value.
update public.generations
set cost_usd = 0.5
where model_id in ('veo3', 'veo3-i2v')
  and cost_usd = 2.5;

-- 2. Seedance 2.0 Mini (seedance-2-mini-i2v) was $0.04/sec — muapi.ai/seedance-2
--    states "$0.08-$0.15/sec" for this tier, so this was understated by at
--    least 2x. cost_usd scales with the chosen duration, so rather than a
--    fixed target value this rescales whatever was stored by the same
--    factor (0.08 / 0.04 = 2x) rather than assuming one specific duration.
update public.generations
set cost_usd = cost_usd * 2
where model_id = 'seedance-2-mini-i2v';
