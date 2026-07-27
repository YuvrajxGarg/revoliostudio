"use client";

import { useState } from "react";
import { Loader2, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { FLOW_INPUT_TOKEN } from "@/lib/flow-types";
import type { OrchestratorStep } from "@/lib/orchestrator-types";

/**
 * Builder view — turn the current Autopilot plan into a reusable Flow. Name
 * it, describe what its input means, and pick which step's prompt the
 * runner's input feeds into (the `{{input}}` token, if present in a prompt,
 * is substituted everywhere at run time regardless).
 */
export function SaveFlowModal({
  steps,
  defaultName,
  onClose,
  onSaved,
}: {
  steps: OrchestratorStep[];
  defaultName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [description, setDescription] = useState("");
  const [inputLabel, setInputLabel] = useState("Subject");
  const [inputStepIndex, setInputStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setError("Give the flow a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, inputLabel, steps, inputStepIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save flow");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Workflow className="h-4 w-4 text-accent" /> Save as Flow
          </div>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="-mt-2 text-[11px] text-muted">
          Reuse these {steps.length} step{steps.length === 1 ? "" : "s"} anytime — just supply a new input.
        </p>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product hero + 5s ad clip"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Description (optional)</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What this flow does…"
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs outline-none focus:border-accent"
          />
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Input label</div>
          <input
            value={inputLabel}
            onChange={(e) => setInputLabel(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-[11px] text-muted">
            Tip: put <code className="rounded bg-surface-2 px-1">{FLOW_INPUT_TOKEN}</code> anywhere in a step below to control exactly where the input lands.
          </p>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Input feeds step</div>
          <div className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setInputStepIndex(i)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                  inputStepIndex === i
                    ? "border-accent/60 bg-accent/10"
                    : "border-border-subtle bg-surface-2 hover:bg-border-subtle"
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border-subtle"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-accent-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
            Save flow
          </button>
        </div>
      </div>
    </div>
  );
}
