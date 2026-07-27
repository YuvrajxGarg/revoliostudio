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
  // Own key (distinct from Gallery's "revolio-grid-width") so Community's
  // default thumbnail scale doesn't fight with the Gallery page's slider.
  const [colWidth, setColWidth] = usePersistentState("revolio-community-grid-width", 260);
  const category = tab === "all" ? undefined : tab;
  const { items, loading, hasMore, loadMore, removeItem } = useCommunityGenerations(category);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-5">
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-6 md:p-8">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Community</h1>
              <p className="mt-0.5 text-sm text-muted max-w-md">
                Generations the community chose to share — publish your own from any generation&apos;s detail panel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-accent text-white" : "text-muted hover:text-foreground"
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
