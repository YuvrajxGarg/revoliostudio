-- Combined convenience script — runs all five pending pricing data-fix
-- migrations (0009-0013) in one paste. Each one recomputes cost_usd for a
-- specific model's historical rows to match the corrected pricing logic
-- now live in src/lib/pricing.ts. Safe to run multiple times (idempotent —
-- each UPDATE just recalculates the same target value).

-- ── 0009: kling-o1-video-edit — was $1.09, real rate is $0.654 ─────────────
update public.generations
set cost_usd = 0.654
where model_id = 'kling-o1-video-edit'
  and cost_usd = 1.09;

-- ── 0010: veo3/veo3-i2v — was $2.50, real rate is $0.50 ────────────────────
-- (0010's original seedance-2-mini-i2v flat 2x rescale is intentionally
-- omitted here — the exact per-row recompute in 0011 below supersedes it.)
update public.generations
set cost_usd = 0.5
where model_id in ('veo3', 'veo3-i2v')
  and cost_usd = 2.5;

-- ── 0011: seedance-2-mini-i2v — recompute from stored resolution+duration ──
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

-- ── 0012: seedream-5-pro / seedream-5-pro-edit — recompute from resolution ──
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

-- ── 0013: gpt-image-2 / gpt-image-2-edit — recompute from resolution ───────
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
