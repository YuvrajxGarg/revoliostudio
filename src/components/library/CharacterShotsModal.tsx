"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

/**
 * Fullscreen grid viewer for a saved character's generated shots
 * (`user_references.shot_urls` — populated by Character Studio's
 * "Save character…" flow, see GenerateTab's handleConfirmSave). Portaled to
 * document.body for the same reason ConfirmModal/ImageLightbox are: avoids
 * being clipped by a backdrop-blur ancestor.
 */
export function CharacterShotsModal({
  name,
  shotUrls,
  posterUrl,
  onClose,
}: {
  name: string;
  shotUrls: string[];
  /** The composited poster (see characterSheetCompositor.ts), if this
   * character was saved with one — shown above the raw shot grid since it's
   * the more useful "one glance" view. */
  posterUrl?: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="animate-modal-in flex w-full max-w-2xl max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{name}</div>
            <p className="mt-0.5 text-xs text-muted">
              {shotUrls.length} generated shot{shotUrls.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {posterUrl && (
              <a
                href={posterUrl}
                download={`${name}-character-sheet.png`}
                title="Download poster"
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Poster
              </a>
            )}
            <button onClick={onClose} title="Close" className="icon-btn-round shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={`${name} character sheet poster`}
            className="w-full rounded-xl border border-border-subtle"
          />
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {shotUrls.map((url, i) => (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${name} shot ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
