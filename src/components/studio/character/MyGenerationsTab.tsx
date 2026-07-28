"use client";

import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";

/**
 * The raw 24 shots from past sheets — same `toolId`-scoped gallery call
 * shape every other single-purpose tool page already uses
 * (ToolStudioView.tsx), just standalone here since Character Studio no
 * longer routes through that component. Shows individual shots, not
 * composited posters — posters aren't archived server-side in v1 (see the
 * Character Sheet plan).
 */
export function MyGenerationsTab() {
  const { items, loading, hasMore, loadMore, removeItem } = useGenerations(undefined, { toolId: "character-sheet" });

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-10">
      <GenerationGrid
        items={items}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onDeleted={removeItem}
        emptyLabel="Nothing generated yet — build a sheet to see the individual shots here."
        columnWidth={180}
      />
    </div>
  );
}
