"use client";

import { useState } from "react";
import { Folder, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useGenerations } from "@/hooks/useGenerations";
import { useTrashedProjects, useProjects } from "@/hooks/useProjects";
import { restoreGeneration, permanentlyDeleteGeneration } from "@/lib/deleteGeneration";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * Soft-deleted projects and generations, restorable or permanently
 * removable. Two separate lists (projects vs. generations) rather than one
 * merged feed — they're different shapes and different restore actions, and
 * Magnific's own Trash keeps them visually distinct too.
 */
export function TrashView() {
  const trashedProjects = useTrashedProjects();
  const { restoreProject, permanentlyDeleteProject } = useProjects();
  const gens = useGenerations(undefined, { trashed: true });
  const [confirmPermanent, setConfirmPermanent] = useState<
    { type: "project" | "generation"; id: string; label: string } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRestoreProject(id: string) {
    setBusyId(id);
    await restoreProject(id);
    await trashedProjects.refresh();
    setBusyId(null);
  }

  async function handleRestoreGeneration(id: string) {
    setBusyId(id);
    const result = await restoreGeneration(id);
    if (result.ok) gens.removeItem(id);
    setBusyId(null);
  }

  async function handleConfirmPermanent() {
    if (!confirmPermanent) return;
    setBusyId(confirmPermanent.id);
    if (confirmPermanent.type === "project") {
      await permanentlyDeleteProject(confirmPermanent.id);
      await trashedProjects.refresh();
    } else {
      await permanentlyDeleteGeneration(confirmPermanent.id);
      gens.removeItem(confirmPermanent.id);
    }
    setBusyId(null);
    setConfirmPermanent(null);
  }

  const isEmpty = !trashedProjects.loading && !gens.loading && trashedProjects.projects.length === 0 && gens.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {isEmpty && (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted">
          <Trash2 className="h-6 w-6" />
          <p className="text-sm">Trash is empty.</p>
        </div>
      )}

      {trashedProjects.projects.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="panel-label">Deleted projects</h2>
          <div className="flex flex-col gap-1.5">
            {trashedProjects.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                  <span className="text-sm truncate">{p.name}</span>
                  <span className="shrink-0 rounded-full border border-border-subtle px-1.5 py-0.5 text-[10px] uppercase text-muted">
                    {p.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRestoreProject(p.id)}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs hover:bg-border-subtle disabled:opacity-50"
                  >
                    {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmPermanent({ type: "project", id: p.id, label: p.name })}
                    className="flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger-text hover:bg-danger/20"
                  >
                    <Trash2 className="h-3 w-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gens.items.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="panel-label">Deleted generations</h2>
          <div className="flex flex-col gap-1.5">
            {gens.items.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {g.thumbnail_url || g.output_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.thumbnail_url || g.output_urls[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <span className="truncate text-muted">{g.prompt || g.model_label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRestoreGeneration(g.id)}
                    disabled={busyId === g.id}
                    className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 hover:bg-border-subtle disabled:opacity-50"
                  >
                    {busyId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmPermanent({ type: "generation", id: g.id, label: g.prompt || g.model_label })}
                    className="flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-danger-text hover:bg-danger/20"
                  >
                    <Trash2 className="h-3 w-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmPermanent && (
        <ConfirmModal
          title={`Permanently delete this ${confirmPermanent.type}?`}
          description="This can't be undone — it won't be recoverable from Trash anymore."
          confirmLabel="Delete forever"
          danger
          loading={busyId === confirmPermanent.id}
          onConfirm={handleConfirmPermanent}
          onCancel={() => setConfirmPermanent(null)}
        />
      )}
    </div>
  );
}
