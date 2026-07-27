"use client";

import { useState } from "react";
import { Trash2, Upload as UploadIcon } from "lucide-react";
import { useUserReferences } from "@/hooks/useUserReferences";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * Every image you've uploaded and saved as a reusable reference (Style /
 * Character / Location / Element) — the Magnific "Uploads" equivalent. Not
 * every file you've ever attached to a prompt (those are ephemeral unless
 * explicitly saved) — just the ones you named and kept, same rows the
 * Reference Library and composer's ReferenceTray already read from.
 */
export function UploadsView() {
  const { references, loading, deleteUserReference } = useUserReferences();
  const uploads = references.filter((r) => r.source === "upload");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted">
        <UploadIcon className="h-6 w-6" />
        <p className="text-sm">
          Nothing saved yet — upload and name a Style, Character, Location, or Element in the{" "}
          <a href="/library" className="text-accent hover:underline">
            Library
          </a>{" "}
          to see it here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {uploads.map((r) => (
          <div key={r.id} className="group relative flex flex-col gap-1.5">
            <div className="aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{r.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted">{r.category}</div>
              </div>
              <button
                onClick={() => setDeleting({ id: r.id, name: r.name })}
                title="Delete"
                className="icon-btn-round !h-6 !w-6 shrink-0 opacity-0 transition-opacity hover:!bg-danger/20 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3 text-danger-text" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleting && (
        <ConfirmModal
          title={`Delete "${deleting.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteUserReference(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
