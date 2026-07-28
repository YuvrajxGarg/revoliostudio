"use client";

import { useState } from "react";
import { Images, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserReferences } from "@/hooks/useUserReferences";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CharacterShotsModal } from "@/components/library/CharacterShotsModal";

/**
 * Saved characters — built entirely on the existing Library reference
 * system (`user_references`, category "character"), no new table. Distinct
 * from character_sheets: this is just "a named face you can reuse," not a
 * link to that character's past sheet results (no join key between the two
 * exists yet — see the Character Sheet plan's known limitations).
 */
export function MyCharactersTab({ onUseCharacter }: { onUseCharacter: (faceUrl: string) => void }) {
  const { references, loading, deleteUserReference } = useUserReferences("character");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [viewingShots, setViewingShots] = useState<{ name: string; shotUrls: string[]; posterUrl: string | null } | null>(
    null
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl shimmer" />
        ))}
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-16 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface-2">
          <UserRound className="h-6 w-6 text-muted" />
        </div>
        <h2 className="text-sm font-semibold">No characters yet</h2>
        <p className="text-xs text-muted max-w-xs">Upload your first reference to build a studio sheet.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {references.map((r) => (
          <div key={r.id} className="group relative flex flex-col gap-1.5">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-surface-2 transition-colors group-hover:border-accent/50">
              <button onClick={() => onUseCharacter(r.image_url)} className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.poster_url || r.image_url}
                  alt={r.name}
                  className={cn("h-full w-full", r.poster_url ? "object-contain" : "object-cover")}
                />
              </button>
              {(r.shot_urls.length > 0 || r.poster_url) && (
                <button
                  onClick={() => setViewingShots({ name: r.name, shotUrls: r.shot_urls, posterUrl: r.poster_url })}
                  title="View generated shots"
                  className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/90"
                >
                  <Images className="h-3 w-3" /> {r.shot_urls.length}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs text-muted">{r.name}</span>
              <button
                onClick={() => setDeleting({ id: r.id, name: r.name })}
                title="Delete"
                className="icon-btn-round !h-5 !w-5 shrink-0 opacity-0 transition-opacity hover:!bg-danger/20 group-hover:opacity-100"
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

      {viewingShots && (
        <CharacterShotsModal
          name={viewingShots.name}
          shotUrls={viewingShots.shotUrls}
          posterUrl={viewingShots.posterUrl}
          onClose={() => setViewingShots(null)}
        />
      )}
    </div>
  );
}
