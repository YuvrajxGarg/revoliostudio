"use client";

import { useState } from "react";
import { ImageDown, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCuratedReferences, type CuratedReference, type ImageRefCategory } from "@/hooks/useCuratedReferences";
import { CuratedReferenceEditorModal } from "./CuratedReferenceEditorModal";
import { PexelsImportModal } from "./PexelsImportModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const CATEGORIES: (ImageRefCategory | "all")[] = ["all", "style", "character", "location", "element"];

/**
 * Admin management for the Reference Library's curated ("By Revolio")
 * picks — same add/edit/delete pattern as the Resources bank admin view.
 * Ships with zero entries; this is how they get added over time instead of
 * a seeded starter set (see migration 0024's comment for why: unlike
 * Resources' external tool links, these need real representative photos we
 * don't have a free source for).
 */
export function CuratedReferenceLibraryAdmin() {
  const [tab, setTab] = useState<ImageRefCategory | "all">("all");
  const { references, loading, addCuratedReference, updateCuratedReference, deleteCuratedReference } =
    useCuratedReferences(tab === "all" ? undefined : tab);
  const [editing, setEditing] = useState<CuratedReference | "new" | null>(null);
  const [deleting, setDeleting] = useState<CuratedReference | null>(null);
  const [importing, setImporting] = useState(false);
  // Pexels import needs one concrete category to file results under — falls
  // back to Style when the "all" tab is active rather than disabling the
  // button, since that's still a perfectly good default to import into.
  const importCategory: ImageRefCategory = tab === "all" ? "style" : tab;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                tab === c ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImporting(true)}
            title={`Search Pexels and add straight into ${importCategory}`}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2"
          >
            <ImageDown className="h-3.5 w-3.5" /> Import from Pexels
          </button>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add reference
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl shimmer" />
          ))}
        </div>
      ) : references.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle p-10 text-center text-sm text-muted">
          No curated {tab === "all" ? "" : `${tab} `}references yet — add one above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {references.map((r) => (
            <div key={r.id} className="group relative flex flex-col gap-1.5">
              <div className="aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{r.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">{r.category}</div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setEditing(r)} title="Edit" className="icon-btn-round !h-6 !w-6">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeleting(r)}
                    title="Delete"
                    className="icon-btn-round !h-6 !w-6 hover:!bg-danger/20"
                  >
                    <Trash2 className="h-3 w-3 text-danger-text" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CuratedReferenceEditorModal
          reference={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const err = editing === "new" ? await addCuratedReference(input) : await updateCuratedReference(editing.id, input);
            if (!err) setEditing(null);
            return err;
          }}
        />
      )}

      {importing && (
        <PexelsImportModal category={importCategory} onClose={() => setImporting(false)} onSave={addCuratedReference} />
      )}

      {deleting && (
        <ConfirmModal
          title={`Delete "${deleting.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteCuratedReference(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
