"use client";

import { useState } from "react";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { TryExampleButton } from "@/components/gallery/TryExampleButton";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { Model3DComposer } from "@/components/composer/Model3DComposer";

export function Studio3DView() {
  const [colWidth, setColWidth] = useState(220);
  // tool_id IS NULL — no 3D tool studios exist yet, but this keeps the
  // plain 3D Generator consistent with Image/Video/Audio's scoping so a
  // future 3D-based tool studio doesn't silently bleed into this gallery.
  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations("3d", { toolId: null });

  async function refetchLatest() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("category", "3d")
      .is("tool_id", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) {
      prepend(data[0] as never);
      pollNow(data[0].id);
    }
  }

  return (
    <div className="flex-1 flex min-h-0 gap-3 px-3 pb-3 pt-3">
      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-y-auto p-3">
        <Model3DComposer onGenerated={refetchLatest} />
      </aside>

      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle/60 shrink-0">
          <span className="text-sm font-medium text-muted">History</span>
          {items.length > 0 && <GridSizeSlider value={colWidth} onChange={setColWidth} />}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 md:px-6 py-4">
            <GenerationGrid
              items={items}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              emptyLabel="No 3D models yet — describe an object or attach reference images."
              emptyAction={<TryExampleButton category="3d" />}
              onToolRun={refetchLatest}
              onDeleted={removeItem}
              columnWidth={colWidth}
            />
          </div>
        </div>

        {/* Fallback composer for narrow screens where the sidebar is hidden. */}
        <div className="lg:hidden shrink-0 border-t border-border-subtle/60 px-4 py-3 max-h-[70vh] overflow-y-auto">
          <div className="mx-auto max-w-3xl">
            <Model3DComposer onGenerated={refetchLatest} />
          </div>
        </div>
      </div>
    </div>
  );
}
