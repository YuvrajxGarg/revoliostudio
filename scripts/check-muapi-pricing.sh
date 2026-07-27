#!/usr/bin/env bash
# One-off script: queries muapi's estimate-cost endpoint for the resolution/
# quality tiers we don't have confirmed prices for yet (gpt-image-2,
# kling-o1-image, kling-o3-image). Run this locally (not in Claude's sandbox
# — its network is allowlisted and can't reach api.muapi.ai with auth
# headers), then paste the full output back into the chat.
#
# Usage:
#   MUAPI_API_KEY=your_key_here bash scripts/check-muapi-pricing.sh

set -u

if [ -z "${MUAPI_API_KEY:-}" ]; then
  echo "Set MUAPI_API_KEY first, e.g.:"
  echo "  MUAPI_API_KEY=your_key_here bash scripts/check-muapi-pricing.sh"
  exit 1
fi

BASE="https://api.muapi.ai/api/v1"

call() {
  local label="$1" slug="$2" body="$3"
  echo "=== $label ==="
  curl -s -X POST "$BASE/models/$slug/estimate-cost" \
    -H "x-api-key: $MUAPI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$body"
  echo
  echo
}

# gpt-image-2 — known: 2K + high = $0.09 (default). Need 1K, 4K at high
# quality, plus low/medium quality at 2K, to see if/how they differ.
call "gpt-image-2 @ 1K/high"     "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"1K","quality":"high"}'
call "gpt-image-2 @ 4K/high"     "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"4K","quality":"high"}'
call "gpt-image-2 @ 2K/low"      "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"2K","quality":"low"}'
call "gpt-image-2 @ 2K/medium"   "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"2K","quality":"medium"}'

# kling-o1-image — known: 1k = $0.036 (default). Need 2k.
call "kling-o1-image @ 2k"       "kling-o1-text-to-image" '{"prompt":"test","resolution":"2k"}'

# kling-o3-image — known: 1K = $0.027 (default). Need 2K, 4K.
call "kling-o3-image @ 2K"       "kling-o3-image" '{"prompt":"test","resolution":"2K"}'
call "kling-o3-image @ 4K"       "kling-o3-image" '{"prompt":"test","resolution":"4K"}'

echo "Done. Copy everything above (from the first '===' onward) back into the chat."
