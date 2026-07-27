"use client";

import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { PresetTemplate } from "@/lib/presets";

/**
 * Admin-only "view/edit prompt" popover for a single Featured Template —
 * opened from the hover pencil button on its card (FeaturedTemplatesGrid).
 * Talks directly to the same admin-gated override endpoints the prompt
 * editor used before (POST to save, DELETE to reset) — see
 * supabase/migrations/0031_preset_prompt_overrides.sql. No admin-panel tab
 * needed; this is the entire UI for it.
 */
export function PresetPromptEditModal({
  preset,
  currentPrompt,
  hasOverride,
  onClose,
  onSaved,
  onReset,
}: {
  preset: PresetTemplate;
  currentPrompt: string;
  hasOverride: boolean;
  onClose: () => void;
  onSaved: (prompt: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(currentPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draft.trim() !== currentPrompt.trim();

  async function handleSave() {
    const prompt = draft.trim();
    if (!prompt || !dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/presets/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: preset.id, prompt }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Save failed" }));
      setError(msg ?? "Save failed");
      return;
    }
    onSaved(prompt);
  }

  async function handleReset() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/presets/overrides?presetId=${encodeURIComponent(preset.id)}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Reset failed" }));
      setError(msg ?? "Reset failed");
      return;
    }
    onReset();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-1">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Edit prompt</h2>
            <div className="truncate text-xs text-muted">
              {preset.title} · {preset.group}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            autoFocus
            className="w-full resize-y rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted focus:border-accent"
            placeholder="Prompt text run for this template"
          />

          {error && <div className="text-xs text-danger-text">{error}</div>}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-sm font-semibold text-white hover:bg-accent-2 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
            {hasOverride && (
              <button
                onClick={handleReset}
                disabled={saving}
                title="Revert to the original hardcoded prompt"
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
