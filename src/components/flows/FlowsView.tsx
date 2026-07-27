"use client";

import { useState } from "react";
import {
  Workflow,
  Play,
  Trash2,
  Globe,
  Copy,
  Loader2,
  Clapperboard,
  Image as ImageIcon,
  Music2,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlows } from "@/hooks/useFlows";
import { RunFlowModal } from "./RunFlowModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Flow } from "@/lib/flow-types";
import type { Category } from "@/lib/models";

function CatIcon({ c }: { c: Category }) {
  const cls = "h-3 w-3";
  if (c === "video") return <Clapperboard className={cls} />;
  if (c === "audio") return <Music2 className={cls} />;
  if (c === "3d") return <Box className={cls} />;
  return <ImageIcon className={cls} />;
}

function authorName(f: Flow): string {
  return f.author?.display_name || f.author?.email?.split("@")[0] || "Someone";
}

function FlowCard({
  flow,
  mine,
  onRun,
  onDelete,
  onTogglePublish,
  onPersonalize,
  busyId,
}: {
  flow: Flow;
  mine: boolean;
  onRun: (f: Flow) => void;
  onDelete: (f: Flow) => void;
  onTogglePublish: (f: Flow) => void;
  onPersonalize: (f: Flow) => void;
  busyId: string | null;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-surface p-4 gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold truncate">
            <Workflow className="h-4 w-4 text-accent shrink-0" /> {flow.name}
          </div>
          {flow.description && <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{flow.description}</p>}
        </div>
      </div>

      {/* Step pipeline preview */}
      <div className="flex flex-wrap items-center gap-1">
        {flow.steps.slice(0, 6).map((s, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
            title={s.label}
          >
            <CatIcon c={s.category} /> {i + 1}
          </span>
        ))}
        {flow.steps.length > 6 && <span className="text-[10px] text-muted">+{flow.steps.length - 6}</span>}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5">Input: {flow.input_label}</span>
        <span>{flow.run_count} run{flow.run_count === 1 ? "" : "s"}</span>
        {!mine && <span className="ml-auto truncate">by {authorName(flow)}</span>}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={() => onRun(flow)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2"
        >
          <Play className="h-3.5 w-3.5" /> Run
        </button>
        {mine ? (
          <>
            <button
              onClick={() => onTogglePublish(flow)}
              disabled={busyId === flow.id}
              title={flow.is_public ? "Published — click to unpublish" : "Publish to Community"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50",
                flow.is_public
                  ? "border-accent/50 bg-accent/10 text-foreground"
                  : "border-border-subtle bg-surface-2 hover:bg-border-subtle"
              )}
            >
              {busyId === flow.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onDelete(flow)}
              title="Delete"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger-text hover:bg-danger/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onPersonalize(flow)}
            disabled={busyId === flow.id}
            title="Personalize — save a copy you can edit"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 text-xs hover:bg-border-subtle disabled:opacity-50"
          >
            {busyId === flow.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Personalize
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Flows — reusable, shareable multi-step workflows (Revolio's take on
 * Magnific Flows). "My flows" are ones you saved from an Autopilot run;
 * "Community" are published flows anyone can run or personalize.
 */
export function FlowsView({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const mineFlows = useFlows("mine");
  const publicFlows = useFlows("public");
  const active = tab === "mine" ? mineFlows : publicFlows;

  const [runFlow, setRunFlow] = useState<Flow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function togglePublish(flow: Flow) {
    setBusyId(flow.id);
    const res = await fetch(`/api/flows/${flow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !flow.is_public }),
    });
    if (res.ok) mineFlows.upsert(await res.json());
    setBusyId(null);
  }

  async function doDelete(flow: Flow) {
    setConfirmDelete(null);
    mineFlows.remove(flow.id);
    await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
  }

  async function personalize(flow: Flow) {
    setBusyId(flow.id);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${flow.name} (copy)`,
        description: flow.description,
        inputLabel: flow.input_label,
        steps: flow.steps,
        inputStepIndex: flow.input_step_index,
      }),
    });
    setBusyId(null);
    if (res.ok) {
      mineFlows.reload();
      setTab("mine");
    }
  }

  return (
    <div className={cn(!embedded && "flex-1 overflow-y-auto")}>
      <div className={cn("flex flex-col gap-4", !embedded && "mx-auto max-w-5xl px-4 md:px-6 py-6")}>
        {!embedded && (
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-semibold">Flows</h1>
            <span className="text-xs text-muted">Save an Autopilot run as a reusable workflow, then run it with new inputs</span>
          </div>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit">
          {(["mine", "public"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {t === "mine" ? "My flows" : "Community"}
            </button>
          ))}
        </div>

        {active.loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : active.flows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
            <Workflow className="h-6 w-6" />
            <p className="text-sm max-w-sm">
              {tab === "mine"
                ? "No flows yet. In Pilot (Autopilot), plan a multi-step run, then hit “Save as Flow” to reuse it."
                : "No published flows yet — be the first to publish one from My flows."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.flows.map((f) => (
              <FlowCard
                key={f.id}
                flow={f}
                mine={tab === "mine"}
                onRun={setRunFlow}
                onDelete={setConfirmDelete}
                onTogglePublish={togglePublish}
                onPersonalize={personalize}
                busyId={busyId}
              />
            ))}
          </div>
        )}
      </div>

      {runFlow && <RunFlowModal flow={runFlow} onClose={() => setRunFlow(null)} />}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete “${confirmDelete.name}”?`}
          description="This can't be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
