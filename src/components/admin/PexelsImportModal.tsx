"use client";

import { useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CuratedReferenceInput, ImageRefCategory } from "@/hooks/useCuratedReferences";
import type { PexelsPhoto } from "@/lib/pexels";

/**
 * Search Pexels' free stock library (no attribution required) and add
 * results straight into curated_references — the "make the library like
 * Magnific" seeding path that doesn't require generating anything or
 * uploading files by hand. Requires PEXELS_API_KEY to be set; the search
 * request surfaces a clear error (via /api/admin/pexels-search) if it's
 * missing rather than failing silently.
 */
export function PexelsImportModal({
  category,
  onClose,
  onSave,
}: {
  category: ImageRefCategory;
  onClose: () => void;
  onSave: (input: CuratedReferenceInput) => Promise<string | null>;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PexelsPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  async function handleSearch() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pexels-search?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.photos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(photo: PexelsPhoto) {
    setAddingId(photo.id);
    setError(null);
    const err = await onSave({
      category,
      name: photo.alt || query.trim(),
      image_url: photo.url,
      thumbnail_url: photo.thumbnailUrl,
      tags: query.trim() ? [query.trim().toLowerCase()] : [],
    });
    setAddingId(null);
    if (err) setError(err);
    else setAddedIds((prev) => new Set(prev).add(photo.id));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[70vh] max-h-[560px] w-full max-w-2xl flex-col rounded-2xl border border-border-subtle bg-surface p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-sm font-semibold capitalize">Import {category} photos from Pexels</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 pb-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. editorial fashion portrait"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && !loading && (
            <p className="text-xs text-muted">
              Search Pexels&apos; free stock library and add results straight to the {category} bank — no download/upload
              step needed.
            </p>
          )}
          <div className="grid grid-cols-4 gap-2.5">
            {results.map((p) => {
              const added = addedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => handleAdd(p)}
                  disabled={added || addingId === p.id}
                  title={added ? "Added" : `Photo by ${p.photographer} — click to add`}
                  className="group relative overflow-hidden rounded-lg border border-border-subtle disabled:cursor-default"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbnailUrl} alt={p.alt} className="aspect-square w-full object-cover" />
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity",
                      !added && "group-hover:opacity-100"
                    )}
                  >
                    {addingId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <span className="text-[10px] font-medium text-white">Add</span>
                    )}
                  </div>
                  {added && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && <div className="pt-2 text-xs text-danger-text">{error}</div>}
      </div>
    </div>
  );
}
