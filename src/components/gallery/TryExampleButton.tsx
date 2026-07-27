"use client";

import { useState } from "react";
import { Dices, Loader2 } from "lucide-react";
import { useComposerStore } from "@/store/composerStore";
import type { Category } from "@/lib/models";

/**
 * "Try an example" — the empty-state quick-start action for a studio's
 * Creations tab. Reuses the same /api/prompt-assist "random" action that
 * backs the Prompt editor's Random prompt button, so a first-time visitor
 * gets a real, ready-to-generate prompt in one click instead of staring at a
 * blank composer and an empty grid. Doesn't generate anything itself — it
 * just fills the prompt in, so the person still hits Generate themselves and
 * sees the button that actually does it.
 */
export function TryExampleButton({ category }: { category: Category }) {
  const setPrompt = useComposerStore((s) => s.setPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/prompt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "random", category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.prompt) throw new Error();
      setPrompt(data.prompt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dices className="h-3.5 w-3.5" />}
        Try an example
      </button>
      {error && <span className="text-[11px] text-danger-text">Couldn't fetch an example — try again.</span>}
    </div>
  );
}
