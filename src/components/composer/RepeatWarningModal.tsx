"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Category, ModelConfig } from "@/lib/models";
import type { VariationSuggestion } from "@/lib/promptAssist";

/**
 * Shown when the user has fired the exact same prompt + references at the
 * same model more than twice (see PromptComposer's repeat check). Rather than
 * only warning, it asks the LLM for a genuinely different thing to try — a
 * reworked prompt and, when one fits, a different model — and offers to apply
 * both in one click ("Use suggested settings") or just copy the new prompt.
 * "Generate anyway" bypasses the nudge and runs the original request.
 *
 * Portaled to document.body for the same reason as the other composer
 * overlays — a `fixed inset-0` from inside a studio's backdrop-blur panel
 * would otherwise be clipped to that panel's bounds.
 */
export function RepeatWarningModal({
  category,
  prompt,
  referenceUrls,
  currentModel,
  candidates,
  onApplyPrompt,
  onApplyModel,
  onGenerateAnyway,
  onClose,
}: {
  category: Category;
  prompt: string;
  referenceUrls: string[];
  currentModel: ModelConfig;
  /** The composer's own selectable models (already filtered to this studio), so a suggested model is always one the user can actually pick here. */
  candidates: ModelConfig[];
  onApplyPrompt: (text: string) => void;
  onApplyModel: (modelId: string) => void;
  onGenerateAnyway: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<VariationSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchSuggestion() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prompt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vary",
          category,
          draft: prompt,
          currentModelLabel: currentModel.label,
          candidates: candidates
            .filter((m) => m.id !== currentModel.id)
            .map((m) => ({ id: m.id, label: m.label, provider: m.provider })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't fetch a suggestion");
      setSuggestion(data.suggestion as VariationSuggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't fetch a suggestion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuggestion();
    // Once per open — inputs are fixed for the life of this modal instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const suggestedModel = suggestion?.suggestedModelId
    ? candidates.find((m) => m.id === suggestion.suggestedModelId) ?? null
    : null;

  async function copyPrompt() {
    if (!suggestion?.suggestedPrompt) return;
    try {
      await navigator.clipboard.writeText(suggestion.suggestedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (permissions/insecure context) — fail
      // quietly, the user can still use "Use suggested settings".
    }
  }

  function useSuggestedSettings() {
    if (!suggestion) return;
    if (suggestion.suggestedPrompt) onApplyPrompt(suggestion.suggestedPrompt);
    if (suggestedModel) onApplyModel(suggestedModel.id);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Same prompt, same model — again</h2>
              <p className="mt-0.5 text-xs text-muted">
                You&apos;ve run this a few times already. Try changing the model or tweaking the prompt
                for a fresher result.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn-round shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Suggestion body */}
        <div className="px-5 py-4 min-h-[180px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Thinking of something better to try…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm text-danger-text">{error}</p>
              <button
                type="button"
                onClick={fetchSuggestion}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          ) : suggestion ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Suggested prompt
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-2 p-3 text-sm leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {suggestion.suggestedPrompt || "(no prompt suggestion)"}
              </div>

              {suggestedModel && (
                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>
                    Switch model to{" "}
                    <span className="font-semibold">{suggestedModel.label}</span>
                    <span className="text-muted"> ({suggestedModel.provider})</span>
                  </span>
                </div>
              )}

              {suggestion.reason && (
                <p className="text-xs text-muted leading-relaxed">{suggestion.reason}</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-border-subtle">
          <button
            type="button"
            onClick={onGenerateAnyway}
            className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Generate anyway
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyPrompt}
              disabled={loading || !suggestion?.suggestedPrompt}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
            <button
              type="button"
              onClick={useSuggestedSettings}
              disabled={loading || !suggestion?.suggestedPrompt}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition-[filter] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Use suggested settings
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
