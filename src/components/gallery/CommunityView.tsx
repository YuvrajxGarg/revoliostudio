"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useCommunityGenerations } from "@/hooks/useCommunityGenerations";
import { GenerationGrid } from "./GenerationGrid";
import { GridSizeSlider } from "./GridSizeSlider";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";

const TABS: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "3d", label: "3D" },
];

/**
 * Community / Explore — the public showcase of generations members opted to
 * publish (see useCommunityGenerations + the 0027 "is_public" RLS). Read-only:
 * cards open the shared detail view (no owner controls), and the prompt can be
 * reused via the detail panel's Recreate.
 */
export function CommunityView() {
  const [tab, setTab] = useState<Category | "all">("all");
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const category = tab === "all" ? undefined : tab;
  const { items, loading, hasMore, loadMore, removeItem } = useCommunityGenerations(category);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold">Community</h1>
          <span className="text-xs text-muted">Generations the community chose to share</span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <GridSizeSlider value={colWidth} onChange={setColWidth} />
        </div>

        <GenerationGrid
          items={items}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onDeleted={removeItem}
          emptyLabel="Nothing published yet — be the first to share a generation from its detail panel."
          columnWidth={colWidth}
          readOnly
        />
      </div>
    </div>
  );
}
