/**
 * Approximate per-generation cost estimator.
 *
 * muapi.ai's real pricing is dynamic per-model (see /api/v1/models —
 * fields `cost`, `cost_currency`, `dynamic_pricing`). We don't call that
 * live on every keystroke (adds latency to the composer), so instead we
 * use tiered heuristics calibrated against real costs pulled from
 * muapi's own catalog (e.g. Meshy 3D = $0.50, mid-tier image edits =
 * $0.02-0.05, premium video 5s = $0.70-2.10) to show a fast, "close
 * enough" estimate next to the Generate button - labeled as an estimate,
 * not an exact invoice amount.
 */

import { ModelConfig } from "./models";

// Approximate USD -> INR. Update if it drifts noticeably from the market rate.
const INR_PER_USD = 88;

const PREMIUM_PROVIDERS = new Set(["OpenAI", "Google", "Midjourney", "Runway", "Kuaishou"]);
const BUDGET_PROVIDERS = new Set(["Vidu", "Lightricks", "Pixverse", "MiniMax"]);

function isHeavyVariant(label: string): boolean {
  return /\b(pro|ultra|max|master|4k|2\.0|4\.5|5\.0|vip)\b/i.test(label);
}

function baseImageCostUSD(model: ModelConfig): number {
  if (model.provider === "Meshy") return 0.5;
  let cost = 0.02;
  if (PREMIUM_PROVIDERS.has(model.provider)) cost = 0.045;
  if (isHeavyVariant(model.label)) cost += 0.02;
  return cost;
}

function baseVideoCostPerSecondUSD(model: ModelConfig): number {
  let perSecond = 0.025;
  if (PREMIUM_PROVIDERS.has(model.provider)) perSecond = 0.09;
  else if (BUDGET_PROVIDERS.has(model.provider)) perSecond = 0.018;
  if (isHeavyVariant(model.label)) perSecond *= 1.4;
  return perSecond;
}

export interface CostEstimateSettings {
  numImages?: number;
  duration?: number;
  resolution?: string;
}

// Flat per-call costs for enhance-mode tools (upscale, background removal —
// no duration/numImages to scale against), pulled from muapi's own catalog
// `cost` field rather than the duration-based video heuristic below.
const ENHANCE_COST_USD: Record<string, number> = {
  "topaz-video-upscale": 0.4,
  "topaz-image-upscale": 0.075,
  "ai-image-upscaler": 0.02,
  "ai-video-upscaler": 0.03,
  // Now routed to Photoroom's Remove Background API (Basic plan, $0.02/image
  // — docs.photoroom.com/getting-started/pricing) instead of muapi's own
  // background remover, per user feedback that muapi's cutouts weren't clean.
  "ai-background-remover": 0.02,
  // Verified against muapi.ai/playground/group/video-edit (2026-07-15).
  "video-watermark-remover": 0.065,
};

// Real flat per-generation costs pulled directly from muapi's own catalog
// `cost` field for specific models (verified via /api/v1/models/{slug}) —
// these override the provider-tier heuristic above where we have an exact
// number instead of an estimate, and don't scale with duration.
//
// The nano-banana entries matter beyond accuracy: muapi's real catalog
// prices the base (text-to-image) and Edit (reference-guided) endpoint of
// each tier IDENTICALLY (nano-banana $0.03/$0.03, nano-banana-2 $0.06/$0.06,
// nano-banana-pro $0.12/$0.12 — confirmed against the live catalog). The old
// heuristic didn't know this, so switching to the Edit sibling after
// attaching a reference could visually look like a cost increase even
// though muapi charges the same base rate either way. See EDIT_COUNTERPART
// in models.ts for why the switch itself happens — muapi's base t2i schemas
// have no image-input field at all, so there's no way to send a reference
// to e.g. "nano-banana-pro" without moving to its Edit counterpart.
// Verified against every video model's live schema too (see below) — 44 of
// 52 image models in the registry fetched cleanly; the 6 that returned an
// empty body (flux-dev, flux-schnell, hidream-fast/dev/full, seededit,
// midjourney-edit) were assumed to be retired/renamed slugs. RESOLVED: they
// were never retired. Each has a live catalog entry under a DIFFERENT key
// than its POST route (flux-dev-image submits fine but only flux-dev is a
// valid GET key), so the schema fetch 404'd while generation kept working.
// models.ts now carries the split via submitEndpoint and their real costs
// are in the table below. (seedream-5's old guessed slug was in this list too —
// fixed by pointing it at the real muapi.ai/seedream endpoints below.
// seedream-v4-edit was also in this list for the same reason — its
// registered slug had "edit"/"v4" in the wrong order — fixed by correcting
// the slug in models.ts; its real cost is confirmed flat $0.04/image,
// matching the base t2i model, via a live schema fetch.)
const IMAGE_FLAT_COST_USD: Record<string, number> = {
  // ── 2026-08 catalog sweep additions (costs from live GET /models) ──
  "flux-3": 0.05,
  "flux-3-dev": 0.025,
  "flux-3-edit": 0.06,
  "qwen3-image": 0.03,
  "qwen-image-2-edit": 0.04,
  "flux-2-klein-4b-turbo": 0.0104,
  "flux-2-dev-edit": 0.031,
  "nano-banana-2-lite": 0.03,
  "flux-kontext-pro": 0.03,
  "wan2.7-edit-pro": 0.1,
  // These 7 are the models the comment above flagged as "returned an empty
  // body ... likely retired/renamed slugs". They were never retired — their
  // catalog GET key just differs from their POST route (now split via
  // submitEndpoint in models.ts), so the schema fetch 404'd and they fell
  // back to the provider-tier heuristic. Real catalog costs:
  "flux-dev": 0.015,
  "flux-schnell": 0.003,
  "hidream-fast": 0.008,
  "hidream-dev": 0.02,
  "hidream-full": 0.04,
  seededit: 0.03,
  "midjourney-edit": 0.1,
  // The whole Klein 4b tier bills a flat $0.0104, same as the 9b turbo below
  // — confirmed on live estimate-cost. The 0.0078/0.0156 pair here looked
  // like a turbo-vs-standard split that muapi doesn't actually charge.
  "flux-2-klein-4b-turbo-edit": 0.0104,
  "flux-2-klein-4b-edit": 0.0104,
  "flux-2-klein-9b-turbo-edit": 0.0104,
  "nano-banana": 0.03,
  "nano-banana-edit": 0.03,
  "nano-banana-2": 0.06,
  "nano-banana-2-edit": 0.06,
  "nano-banana-pro": 0.12,
  "nano-banana-pro-edit": 0.12,
  "seedream-v4": 0.04,
  "seedream-v4-edit": 0.04,
  // Verified against muapi.ai/seedream (2026) — Pro starts at $0.045/image
  // (1K, rising to $0.09 at 2K), Lite is a flat $0.0325/image up to 4K. Pro's
  // 1K/2K split is now handled by IMAGE_RESOLUTION_FLAT_COST_USD below; this
  // 0.045 entry stays as the fallback when settings.resolution is unset.
  "seedream-5-pro": 0.045,
  "seedream-5-pro-edit": 0.045,
  "seedream-5-lite": 0.0325,
  "seedream-5-lite-edit": 0.0325,
  "flux-krea": 0.015,
  "flux-2-dev": 0.015,
  "flux-2-pro": 0.032,
  "flux-2-flex": 0.09,
  "wan2.7-image": 0.05,
  "wan2.7-image-pro": 0.1,
  // Confirmed via muapi's authenticated estimate-cost endpoint (real user
  // API key, live call) — resolution-tiered: $0.06 @ 1K, $0.09 @ 2K,
  // $0.15 @ 4K (all at "high" quality). See IMAGE_RESOLUTION_FLAT_COST_USD
  // below for the real per-resolution prices. This 0.09 stays as the
  // fallback for the default (2K) tier when settings.resolution is unset.
  // Note: muapi's schema for this model also exposes a separate "quality"
  // dropdown (low/medium/high, confirmed cheaper at low/medium — e.g. 2K
  // costs $0.04 at low quality vs $0.09 at high) but our payload never
  // submits that field today (RESOLUTION_CANDIDATES in generate.ts matches
  // "resolution" first and only sends one field), so muapi always defaults
  // to "high" server-side — meaning the resolution-only ladder below is a
  // fully accurate model of what we actually charge right now. If a
  // quality selector ever gets wired into the UI, this needs a second
  // dimension.
  "gpt4o-image": 0.04,
  "gpt-image-2": 0.09,
  "imagen4": 0.03,
  "imagen4-ultra": 0.06,
  "midjourney-v7": 0.1,
  "midjourney-v8": 0.1,
  "seedream-v4.5": 0.05,
  "qwen-image": 0.03,
  "qwen-image-2": 0.04,
  // Verified flat via muapi's authenticated estimate-cost endpoint — despite
  // exposing a resolution dropdown (1k/2k) and dynamic_pricing:true in its
  // schema, the actual billed cost is identical at both tiers ($0.036).
  // Previously flagged as unverified; confirmed correct as-is.
  "kling-o1-image": 0.036,
  // Verified flat via muapi's authenticated estimate-cost endpoint — same
  // situation as kling-o1-image above: resolution dropdown (1K/2K, and by
  // strong inference 4K) exists but the billed cost doesn't move ($0.027).
  // Previously flagged as unverified; confirmed correct as-is.
  "kling-o3-image": 0.027,
  "hunyuan-image": 0.035,
  "hunyuan-image-3": 0.065,
  "ideogram-v3": 0.02,
  "reve-image": 0.032,
  "z-image": 0.013,
  "z-image-turbo": 0.007,
  "leonardo-lucid": 0.03,
  "leonardo-phoenix": 0.05,
  "grok-image": 0.05,
  "flux-kontext-pro-edit": 0.03,
  "flux-kontext-max-edit": 0.06,
  "flux-2-pro-edit": 0.032,
  "gpt4o-edit": 0.04,
  "gpt-image-2-edit": 0.09,
  "seedream-4.5-edit": 0.05,
  "reve-edit": 0.05,
  "qwen-edit": 0.03,
  "qwen-edit-plus": 0.03,
  "nano-banana-effects": 0.03,
  "kling-o1-edit": 0.036,
  "kling-o3-edit": 0.027,
  "wan2.7-edit": 0.05,
  "ideogram-reframe": 0.15,
  "flux-pulid": 0.04,
  "grok-edit": 0.05,
};

// Real per-second video costs, derived from muapi's own catalog `cost`
// field divided by that model's default duration — verified live against
// every t2v/i2v/flf/omni model in the registry via /api/v1/models/{slug}.
//
// This used to be a VIDEO_FLAT_COST_USD table applied as a single flat
// number regardless of chosen duration, which was wrong for every model
// that has an adjustable duration control since it scales the real muapi
// bill. The bug this was reported against: "seedance-2-omni" (multi-ref
// mode) wasn't even in that table, so it fell through to the generic
// heuristic below and showed ~$0.14-0.18 for a 4s clip when muapi actually
// charges $0.30/sec (high quality, the default) — $1.20 for 4s, matching
// what was reported. A second report showed the same gap on plain
// "Seedance 2.0" (seedance-2-t2v, text-to-video): heuristic showed $0.17
// for 5s, real rate is $0.25/sec ($1.25 for 5s).
const VIDEO_PER_SECOND_COST_USD: Record<string, number> = {
  // ── 2026-08 catalog sweep additions ──
  // rate = live cost at the model's default duration / that duration.
  // Live: 5s=$0.95, 8s=$1.52, 10s=$1.90 -> exactly 0.19/sec. The catalog
  // `cost` field said $0.104, which is not what the account is billed.
  "ltx-2.3-t2v": 0.19,
  "ltx-2.3-i2v": 0.19,
  "kling-v2.5-turbo-pro-t2v": 0.09,
  "kling-o1-t2v": 0.144,
  "kling-o1-i2v": 0.144,
  "kling-v3-turbo-std-t2v": 0.112,
  "kling-v3-turbo-pro-i2v": 0.14,
  "kling-v3-omni-std-i2v": 0.084,
  "minimax-2.3-std-i2v": 0.1825,
  "minimax-h3-open-t2v": 0.052,
  "seedance-2-mini-t2v": 0.15,
  "seedance-pro-t2v-fast": 0.03,
  "vidu-q3-turbo-i2v": 0.06,
  "seedance-2.5-video-edit-480p": 0.17,
  // Live: 5s=$0.65, 8s=$1.04, 10s=$1.30 -> 0.13/sec (catalog said flat $0.10).
  "wan2.7-video-edit": 0.13,
  "mmaudio-video-sound": 0.001,
  "kling-v2.5-turbo-pro-i2v": 0.09,
  "kling-v2.5-turbo-std-i2v": 0.056,
  "seedance-lite-i2v": 0.02,
  "seedance-pro-i2v-fast": 0.012,
  // Fallback only — seedance-2-mini-i2v's real rate depends on the selected
  // resolution (480p vs 720p) and is handled by VIDEO_RESOLUTION_PER_SECOND_COST_USD
  // below. This is only used if settings.resolution is missing entirely
  // (e.g. the preview estimates in ModelSelector/EditVideoComposer that call
  // estimateCostUSD with no settings at all). Was the 480p rate (0.08), but
  // muapi defaults this model to 720p when no resolution is sent, so the
  // no-settings preview was showing half the real price — use the 720p rate,
  // which is what an unmodified submit actually bills.
  "seedance-2-mini-i2v": 0.15,
  // Seedance 2.0 / sd-2 family — catalog cost $1.25 @ 5s default for
  // i2v/first-last-frame/t2v, $1.50 @ 5s default for omni-reference.
  "seedance-2-t2v": 0.25,
  "seedance-2-i2v": 0.25,
  "seedance-2-flf": 0.25,
  "seedance-2-omni": 0.3,
  // Seedance 2.5 family — the ENTIRE family was missing from this table and
  // fell through to baseVideoCostPerSecondUSD's ByteDance heuristic (0.025/s,
  // or 0.035/s where the label matched /4k/), showing ~$0.13 for clips that
  // really bill $0.85-$8.50. That is a 7x-49x understatement depending on
  // tier. Rates below are exact: derived from muapi's authenticated
  // /models/{slug}/estimate-cost endpoint, which was confirmed to scale
  // perfectly linearly with duration for every one of these 16 (probed at
  // 4s/5s/10s — e.g. omni-reference 5s=$1.70, 8s=$2.72, 10s=$3.40 = 0.34/s
  // exactly). Each resolution tier is a clean 2x step: 480p 0.17, 720p 0.34,
  // 1080p 0.85, 4K 1.70 — and t2v/i2v/flf/omni all bill identically within a
  // tier, unlike the 2.0 family where omni costs more than the rest.
  "seedance-2.5-t2v-480p": 0.17,
  "seedance-2.5-i2v-480p": 0.17,
  "seedance-2.5-flf-480p": 0.17,
  "seedance-2.5-omni-480p": 0.17,
  "seedance-2.5-t2v": 0.34,
  "seedance-2.5-i2v": 0.34,
  "seedance-2.5-flf": 0.34,
  "seedance-2.5-omni": 0.34,
  "seedance-2.5-t2v-1080p": 0.85,
  "seedance-2.5-i2v-1080p": 0.85,
  "seedance-2.5-flf-1080p": 0.85,
  "seedance-2.5-omni-1080p": 0.85,
  "seedance-2.5-t2v-4k": 1.7,
  "seedance-2.5-i2v-4k": 1.7,
  "seedance-2.5-flf-4k": 1.7,
  "seedance-2.5-omni-4k": 1.7,
  "kling-v3-pro-t2v": 0.144,
  "kling-v3-std-t2v": 0.144,
  "kling-v3-pro-i2v": 0.144,
  "kling-v3-std-i2v": 0.144,
  // veo3.1 / veo3.1-i2v / veo3.1-ref / veo4 were here as per-second rates
  // that happened to be exact at their 8s default (0.3125*8 = $2.50) but
  // wrong at every other duration. The whole Veo family actually bills a
  // FLAT per-video price — confirmed identical at 4s/5s/8s/10s on the live
  // estimate-cost endpoint — so they now live in VIDEO_FLAT_COST_USD below.
  // Same for kling-master-t2v/i2v, which bills flat $1.20.
  "kling-std-i2v": 0.045,
  "kling-pro-i2v": 0.08,
  "kling-v3-4k-t2v": 0.4,
  "kling-v3-4k-i2v": 0.4,
  "kling-v3-omni-t2v": 0.112,
  "kling-v3-omni-i2v": 0.112,
  // Was 0.02/sec for all three — a 6.5x understatement. Live estimate-cost:
  // t2v/i2v are exactly 0.13/sec (4s=$0.52, 5s=$0.65, 8s=$1.04, linear).
  "wan2.7-t2v": 0.13,
  "wan2.7-i2v": 0.13,
  // wan2.7-ref is the one model here that is NOT a pure per-second rate: it
  // bills a $0.50 flat base plus $0.13/sec (3s=$0.89, 5s=$1.15, 10s=$1.80 —
  // fits cost = 0.50 + 0.13d exactly). This table can only express a single
  // rate, so 0.23 is chosen to be exact at the 5s default; it over-states
  // above that (10s shows $2.30 vs $1.80 real) and under-states below it.
  // Erring high on the long end is the safe direction for a displayed
  // estimate. If base+rate models become common, extend the estimator
  // rather than stretching this number.
  "wan2.7-ref": 0.23,
  "seedance-pro-t2v": 0.036,
  "seedance-pro-i2v": 0.036,
  "seedance-2-vip-t2v": 0.3,
  "seedance-2-vip-i2v": 0.3,
  "runway-t2v": 0.018,
  "runway-i2v": 0.03,
  "pixverse-v6-t2v": 0.059,
  "pixverse-v6-i2v": 0.059,
  "pixverse-v6-transition": 0.06,
  "vidu-q3-pro-t2v": 0.15,
  "vidu-q3-pro-i2v": 0.15,
  "vidu-q3-flf": 0.15,
  "ltx-2-pro-t2v": 0.0767,
  "ltx-2-pro-i2v": 0.0767,
  "sora-2-t2v": 0.1,
  "sora-2-i2v": 0.1,
  "sora-2-pro-t2v": 0.3,
  "sora-2-pro-i2v": 0.3,
};

// Some models' real per-second rate isn't a single number — it depends on
// the selected resolution/quality tier. Found via a live user report: the
// composer showed $0.80 for a 10s Seedance 2.0 Mini clip (flat 0.08/sec)
// but the completed generation was actually billed $1.50 (i.e. 0.15/sec) —
// because the user had 720p selected. muapi.ai/seedance-2 confirms Mini
// tier is "$0.08-$0.15/sec" across "480p-720p": 0.08 is the 480p rate and
// 0.15 is the 720p rate, not two ends of a vague range. Keyed by the exact
// resolution string values the live schema returns (see SettingsBar's
// `schema.resolutions`).
const VIDEO_RESOLUTION_PER_SECOND_COST_USD: Record<string, Record<string, number>> = {
  "seedance-2-mini-i2v": { "480p": 0.08, "720p": 0.15 },
};

// Same problem as VIDEO_RESOLUTION_PER_SECOND_COST_USD but for images — some
// image models' real per-image price also depends on the selected output
// resolution rather than being a single flat number.
//
// seedream-5-pro: muapi.ai/seedream explicitly states "$0.045/image at 1K
// resolution, or $0.09/image at 2K resolution" — a flat-out 2x difference
// we were missing entirely (IMAGE_FLAT_COST_USD had it hardcoded at the 1K
// rate no matter what the user picked).
//
// gpt-image-2: confirmed live via muapi's authenticated estimate-cost
// endpoint (real user API key) — $0.06 @ 1K, $0.09 @ 2K, $0.15 @ 4K, all at
// the "high" quality tier muapi defaults to since we never submit a
// separate quality field (see the comment on IMAGE_FLAT_COST_USD's
// gpt-image-2 entry).
//
// Keyed by the exact resolution string the live schema returns; casing is
// covered defensively for both "1K"/"2K"/"4K" and "1k"/"2k"/"4k" since this
// sandbox couldn't always confirm the literal enum casing muapi returns for
// every model.
const IMAGE_RESOLUTION_FLAT_COST_USD: Record<string, Record<string, number>> = {
  "seedream-5-pro": { "1K": 0.045, "2K": 0.09, "1k": 0.045, "2k": 0.09 },
  "seedream-5-pro-edit": { "1K": 0.045, "2K": 0.09, "1k": 0.045, "2k": 0.09 },
  "gpt-image-2": { "1K": 0.06, "2K": 0.09, "4K": 0.15, "1k": 0.06, "2k": 0.09, "4k": 0.15 },
  // Not independently tested (only the t2i endpoint was queried live), but
  // shares the same "gpt-image-2-cost" cost_strategy per muapi's schema, so
  // applying the same resolution ladder here rather than leaving it flat.
  "gpt-image-2-edit": { "1K": 0.06, "2K": 0.09, "4K": 0.15, "1k": 0.06, "2k": 0.09, "4k": 0.15 },
};

// Real FLAT per-generation video costs — these models' live schemas expose
// no adjustable `duration` field at all (fixed-length output, or length
// driven entirely by an input clip like Edit Video / Motion Control), so
// unlike the per-second table above the duration picker in our UI doesn't
// change what muapi actually bills and the cost should never be multiplied
// by the selected duration.
const VIDEO_FLAT_COST_USD: Record<string, number> = {
  // ── 2026-08 catalog sweep additions (no duration field in schema) ──
  // NB: every one of these four differed from the catalog `cost` field and
  // was corrected against live estimate-cost with a real input supplied.
  "hunyuan-fast-t2v": 0.05,
  // Veo family bills flat; Lite is $0.30 at every duration (schema pins 8s).
  "veo3.1-lite-t2v": 0.3,
  "veo3.1-lite-i2v": 0.3,
  "runway-aleph": 0.9,
  "video-background-remover": 0.05,
  // These were set to 0.50 on the strength of muapi's public pricing PAGE
  // ("Veo 3 Text to Video / Image to Video ~$0.50/video"). That page
  // disagrees with what the account is actually billed: muapi's own
  // authenticated /models/veo3-text-to-video/estimate-cost returns $2.50 —
  // flat, identical at 4s/5s/8s/10s — and veo3-image-to-video likewise.
  // The live endpoint is what the bill is computed from, so it wins over the
  // marketing page. $2.50 also lines up with the rest of the family
  // (veo3.1 $2.50, veo4 $3.00) in a way that $0.50 never did.
  // Re-check here first if muapi's Veo pricing is ever disputed.
  veo3: 2.5,
  "veo3-i2v": 2.5,
  // Whole Veo family bills flat per video, not per second — see the note in
  // VIDEO_PER_SECOND_COST_USD above. Verified 4s/5s/8s/10s all identical.
  "veo3.1": 2.5,
  "veo3.1-i2v": 2.5,
  "veo3.1-ref": 0.6,
  veo4: 3.0,
  "veo4-i2v": 3.0,
  // Flat $1.20 for any duration up to 8s, stepping to $2.40 at 10s (muapi
  // prices Master in two duration tiers rather than per-second). This table
  // holds one number, so it carries the $1.20 tier that covers the 5s
  // default and every shorter option; a 10s selection under-states by 2x.
  "kling-master-t2v": 1.2,
  "kling-master-i2v": 1.2,
  "hunyuan-t2v": 0.15,
  "hunyuan-i2v": 0.15,
  "minimax-2.3-pro-t2v": 0.63,
  "minimax-2.3-pro-i2v": 0.63,
  "leonardo-motion": 0.4,
  // Was 0.654 — wrong the other way. Re-verified 2026-07-15 against
  // muapi.ai/playground/group/video-edit's own listing, which prices this
  // exact endpoint slug ("kling-o1-video-edit", distinct from the
  // "-fast"/"-standard" siblings we don't carry) at $1.09 effective — also
  // matches a fresh user-reported Generate button screenshot showing
  // "$1.09" for this same model. The earlier 0.654 figure was likely read
  // off the wrong sibling (kling-o1-video-edit-fast, $0.585) or a stale
  // muapi price; reverting to the confirmed-current $1.09.
  "kling-o1-video-edit": 1.09,
  // Seedance 2.0 Video Edit — muapi catalog `cost` $1.50 (dynamic_pricing,
  // "basic" quality @ 5s default). Flat here since the Edit Video composer
  // exposes no duration/quality control, so the bill doesn't move with UI.
  "seedance-2-video-edit": 1.5,
  "runway-motion-control": 0.07,
  // Verified against muapi.ai/playground/group/video-edit's own listing
  // (2026-07-15) — flat per-generation costs, not duration-scaled (none of
  // these expose a duration control in our UI). Added alongside the models
  // themselves; without an entry here they were silently falling through to
  // the generic per-second heuristic, which is off by 2-4x for most of these.
  "kling-v3-pro-motion-control": 0.16,
  "kling-v3-std-motion-control": 0.1,
  "kling-v2.6-pro-motion-control": 0.145,
  "kling-v2.6-std-motion-control": 0.45,
  "ai-dance-effects": 0.3,
  "ai-video-face-swap": 0.1,
  // Was absent entirely and fell through to the Alibaba per-second heuristic
  // (~$0.13). Catalog prices wan2.2-animate flat at $0.35; its length is
  // driven by the input clip, so there's no duration to scale by.
  "wan-animate": 0.35,
  // Both corrected against live estimate-cost (flat, duration-independent):
  // luma-flash-reframe was 0.35 but really bills $0.25 (a 1.4x overcharge to
  // the user), and autocrop was 0.05 against a real $0.10 (2x under).
  "luma-flash-reframe": 0.25,
  autocrop: 0.1,
};

// Audio models — not independently confirmed against a live authenticated
// muapi estimate-cost call (see the doc comment on the `audio` section of
// models.ts), so these are rough placeholders based on typical wrapper-API
// pricing for Suno-style full-song generation vs. MMAudio-style short
// clips, clearly rougher than the rest of this file's verified numbers.
const THREED_FLAT_COST_USD: Record<string, number> = {
  "tripo-h31-t23d": 0.2,
};

const AUDIO_FLAT_COST_USD: Record<string, number> = {
  "suno-music": 0.12,
  // Catalog lists mmaudio-v2-text-to-audio at a flat $0.01; this was 0.02,
  // a 2x overcharge. (estimate-cost can't price this one without a real
  // input, so the catalog `cost` field is the source here.)
  "mmaudio-text-to-audio": 0.01,
};

/** Rough estimated cost in USD for one generate click with the given settings. */
export function estimateCostUSD(model: ModelConfig, settings: CostEstimateSettings): number {
  if (model.mode === "enhance" && ENHANCE_COST_USD[model.id] != null) {
    return ENHANCE_COST_USD[model.id];
  }
  if (model.category === "3d") {
    // Was a flat Meshy-or-not guess (0.5 / 0.4). Tripo's H3.1 models are
    // really $0.20-$0.30, so a per-model table is needed now that 3D has
    // more than one provider. Falls back to the old 0.4 for anything new.
    return THREED_FLAT_COST_USD[model.id] ?? (model.provider === "Meshy" ? 0.5 : 0.4);
  }
  if (model.category === "audio") {
    return AUDIO_FLAT_COST_USD[model.id] ?? 0.05;
  }
  if (model.category === "image") {
    const imageResolutionRates = IMAGE_RESOLUTION_FLAT_COST_USD[model.id];
    const imageResolutionRate =
      imageResolutionRates && settings.resolution ? imageResolutionRates[settings.resolution] : undefined;
    const per = imageResolutionRate ?? IMAGE_FLAT_COST_USD[model.id] ?? baseImageCostUSD(model);
    const n = Math.max(1, settings.numImages || 1);
    return round3(per * n);
  }
  // video
  if (VIDEO_FLAT_COST_USD[model.id] != null) {
    return VIDEO_FLAT_COST_USD[model.id];
  }
  // Always scale by the actually-selected duration, using a verified real
  // per-second rate where we have one and falling back to the
  // provider-tier heuristic otherwise (currently just midjourney-i2v,
  // whose muapi slug returned an empty response on fetch).
  const dur = settings.duration ?? model.defaultDuration ?? 5;
  const resolutionRates = VIDEO_RESOLUTION_PER_SECOND_COST_USD[model.id];
  const resolutionRate = resolutionRates && settings.resolution ? resolutionRates[settings.resolution] : undefined;
  const perSecond = resolutionRate ?? VIDEO_PER_SECOND_COST_USD[model.id] ?? baseVideoCostPerSecondUSD(model);
  return round3(perSecond * dur);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function formatCostUSD(usd: number): string {
  return usd < 0.1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
}

export function formatCostINR(usd: number): string {
  const inr = usd * INR_PER_USD;
  return inr < 10 ? `₹${inr.toFixed(1)}` : `₹${Math.round(inr)}`;
}
