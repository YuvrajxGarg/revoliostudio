"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Workflow, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpaces } from "@/hooks/useSpaces";
import { FlowsView } from "@/components/flows/FlowsView";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Space } from "@/lib/space-types";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function SpaceCard({ space, onOpen, onDelete }: { space: Space; onOpen: () => void; onDelete: () => void }) {
  const nodeCount = space.graph?.nodes?.length ?? 0;
  const genCount = space.graph?.nodes?.filter((n) => n.type === "generate").length ?? 0;
  const thumb = space.graph?.nodes?.find((n) => n.type === "generate" && (n.data as { outputUrl?: string }).outputUrl) as
    | { data: { outputUrl?: string } }
    | undefined;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-accent/50 transition-colors">
      <button onClick={onOpen} className="relative aspect-video w-full overflow-hidden bg-surface-2 text-left">
        {thumb?.data.outputUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.data.outputUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Zap className="h-6 w-6" />
          </div>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <div className="truncate text-sm font-medium">{space.name}</div>
          <div className="text-[11px] text-muted">
            {nodeCount} node{nodeCount === 1 ? "" : "s"} · {genCount} step{genCount === 1 ? "" : "s"} · {timeAgo(space.updated_at)}
          </div>
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-muted hover:text-danger-text transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Spaces — the node-based workflow hub. "My spaces" are your canvases;
 * "Flows" (reusing FlowsView) are the saved, runnable, shareable layer.
 */
export function SpacesHub() {
  const router = useRouter();
  const [tab, setTab] = useState<"spaces" | "flows">("spaces");
  const { spaces, loading, remove } = useSpaces();
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Space | null>(null);

  async function newSpace() {
    setCreating(true);
    const res = await fetch("/api/spaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setCreating(false);
    if (res.ok) {
      const s = await res.json();
      router.push(`/spaces/${s.id}`);
    }
  }

  async function doDelete(space: Space) {
    setConfirmDelete(null);
    remove(space.id);
    await fetch(`/api/spaces/${space.id}`, { method: "DELETE" });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">Spaces</h1>
          <p className="mt-1 text-sm text-muted">Build node-based generative workflows and bring your ideas to life.</p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit">
            <button
              onClick={() => setTab("spaces")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "spaces" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Zap className="h-3.5 w-3.5" /> My spaces
            </button>
            <button
              onClick={() => setTab("flows")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "flows" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Workflow className="h-3.5 w-3.5" /> Flows
            </button>
          </div>
          {tab === "spaces" && (
            <button
              onClick={newSpace}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New space
            </button>
          )}
        </div>

        {tab === "flows" ? (
          <FlowsView embedded />
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
            <Zap className="h-6 w-6" />
            <p className="text-sm max-w-sm">No spaces yet. Create one to wire images, prompts and generate steps into a workflow.</p>
            <button
              onClick={newSpace}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-2"
            >
              <Plus className="h-4 w-4" /> New space
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <SpaceCard
                key={s.id}
                space={s}
                onOpen={() => router.push(`/spaces/${s.id}`)}
                onDelete={() => setConfirmDelete(s)}
              />
            ))}
          </div>
        )}
      </div>

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
