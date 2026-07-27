"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, X, Workflow } from "lucide-react";
import type { Flow } from "@/lib/flow-types";
import { formatErrorMessage } from "@/lib/errorFormat";

/**
 * Runner view of a flow — you don't see the node internals, just the input.
 * Fill it in, Run, and it seeds an Autopilot run (input substituted into the
 * saved steps) and opens it in Pilot to review the cost and execute.
 */
export function RunFlowModal({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/flows/${flow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.runId) throw new Error(data.error || "Couldn't start the flow");
      router.push(`/autopilot?run=${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Workflow className="h-4 w-4 text-accent shrink-0" /> {flow.name}
            </div>
            {flow.description && <p className="mt-1 text-xs text-muted leading-relaxed">{flow.description}</p>}
          </div>
          <button onClick={onClose} className="icon-btn-round shrink-0" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{flow.input_label}</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`e.g. what should this flow's ${flow.input_label.toLowerCase()} be?`}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Runs {flow.steps.length} step{flow.steps.length === 1 ? "" : "s"} — you'll review the cost before it executes.
          </p>
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
            onClick={run}
            disabled={running}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-accent-2"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run flow
          </button>
        </div>
      </div>
    </div>
  );
}
