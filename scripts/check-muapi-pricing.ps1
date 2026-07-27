# One-off script: queries muapi's estimate-cost endpoint for the resolution/
# quality tiers we don't have confirmed prices for yet (gpt-image-2,
# kling-o1-image, kling-o3-image).
#
# How to run this (Windows):
#   1. Open PowerShell yourself — search "PowerShell" in the Start menu and
#      click it. Do NOT double-click this file in File Explorer; that opens
#      and closes a window instantly and you'll never see the output.
#   2. In the PowerShell window, paste this single line (with your real key)
#      and press Enter:
#
#      $env:MUAPI_API_KEY = "paste_your_key_here"; C:\Users\yuvra\Documents\'Revolio Ai Studio'\revolio-studio\scripts\check-muapi-pricing.ps1
#
#   3. Copy everything it prints and paste it back into the chat.

if (-not $env:MUAPI_API_KEY) {
    Write-Host "Set MUAPI_API_KEY first, e.g.:"
    Write-Host '  $env:MUAPI_API_KEY = "your_key_here"; .\check-muapi-pricing.ps1'
    exit 1
}

$base = "https://api.muapi.ai/api/v1"
$headers = @{ "x-api-key" = $env:MUAPI_API_KEY; "Content-Type" = "application/json" }

function Call($label, $slug, $body) {
    Write-Host "=== $label ==="
    try {
        $resp = Invoke-RestMethod -Method Post -Uri "$base/models/$slug/estimate-cost" -Headers $headers -Body $body
        $resp | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host $reader.ReadToEnd()
        }
    }
    Write-Host ""
}

# gpt-image-2 — known: 2K + high = $0.09 (default). Need 1K, 4K at high
# quality, plus low/medium quality at 2K.
Call "gpt-image-2 @ 1K/high"   "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"1K","quality":"high"}'
Call "gpt-image-2 @ 4K/high"   "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"4K","quality":"high"}'
Call "gpt-image-2 @ 2K/low"    "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"2K","quality":"low"}'
Call "gpt-image-2 @ 2K/medium" "gpt-image-2-text-to-image" '{"prompt":"test","resolution":"2K","quality":"medium"}'

# kling-o1-image — known: 1k = $0.036 (default). Need 2k.
Call "kling-o1-image @ 2k"     "kling-o1-text-to-image" '{"prompt":"test","resolution":"2k"}'

# kling-o3-image — known: 1K = $0.027 (default). Need 2K, 4K.
Call "kling-o3-image @ 2K"     "kling-o3-image" '{"prompt":"test","resolution":"2K"}'
Call "kling-o3-image @ 4K"     "kling-o3-image" '{"prompt":"test","resolution":"4K"}'

Write-Host "Done. Copy everything above (from the first '===' onward) back into the chat."
