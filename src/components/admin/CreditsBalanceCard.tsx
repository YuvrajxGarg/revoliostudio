"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const MUAPI_DASHBOARD_URL = "https://muapi.ai/dashboard";
const MUAPI_TOPUP_URL = "https://muapi.ai/topup";
const PRESET_AMOUNTS = [10, 25, 50, 100];

interface BalanceResponse {
  balance: { credits: number | null; usd: number | null; raw: Record<string, unknown> } | null;
  balanceError: string | null;
  autoTopup: Record<string, unknown> | null;
}

export function CreditsBalanceCard() {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);
  const [topupNote, setTopupNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/account/balance");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTopup() {
    const amt = customAmount.trim() ? Number(customAmount) : amount;
    if (!amt || amt <= 0) return;
    setToppingUp(true);
    setTopupNote(null);
    try {
      const res = await fetch("/api/admin/account/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amt }),
      });
      const json = await res.json();
      if (res.ok && json.checkoutUrl) {
        window.open(json.checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        // muapi's topup request shape isn't fully documented — if this
        // fails for any reason, fall back to their own hosted page so the
        // feature still works instead of being a dead end.
        setTopupNote((json.error || "Couldn't start checkout") + " — opened muapi's top-up page instead.");
        window.open(MUAPI_TOPUP_URL, "_blank", "noopener,noreferrer");
      }
    } catch {
      setTopupNote("Couldn't reach muapi — opened the top-up page instead.");
      window.open(MUAPI_TOPUP_URL, "_blank", "noopener,noreferrer");
    } finally {
      setToppingUp(false);
    }
  }

  const credits = data?.balance?.credits;
  const usd = data?.balance?.usd;
  const autoTopupRaw = data?.autoTopup;
  const autoTopupEnabled =
    autoTopupRaw && typeof autoTopupRaw.enabled === "boolean" ? (autoTopupRaw.enabled as boolean) : null;

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">muapi credit balance</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            title="Refresh balance"
            className="icon-btn-round disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <a
            href={MUAPI_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 hover:bg-border-subtle transition-colors"
          >
            muapi dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <div className="text-xs text-muted">Current balance</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading
              ? "…"
              : credits != null
                ? `${credits.toLocaleString()} credits`
                : usd != null
                  ? `$${usd.toFixed(2)}`
                  : "—"}
          </div>
          {data?.balanceError && <div className="mt-1 text-[11px] text-danger-text">{data.balanceError}</div>}
        </div>
        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <div className="text-xs text-muted">Auto top-up</div>
          <div className="mt-1 text-2xl font-semibold">
            {autoTopupEnabled == null ? "—" : autoTopupEnabled ? "On" : "Off"}
          </div>
          <div className="mt-1 text-[11px] text-muted">Manage on muapi&apos;s dashboard</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted">Add credits</div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAmount(a);
                setCustomAmount("");
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                amount === a && !customAmount
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-subtle bg-surface-2 hover:bg-border-subtle"
              )}
            >
              ${a}
            </button>
          ))}
          <input
            type="number"
            min={1}
            placeholder="Custom $"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-24 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button
            onClick={handleTopup}
            disabled={toppingUp}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition-[filter] disabled:opacity-50"
          >
            {toppingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Top up
          </button>
        </div>
        {topupNote && <div className="text-[11px] text-muted">{topupNote}</div>}
        <p className="text-[11px] text-muted">
          Opens muapi&apos;s hosted Stripe checkout in a new tab — card details are entered there, never on this
          site.
        </p>
      </div>
    </Card>
  );
}
