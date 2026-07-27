"use client";

import { useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSearchParams } from "next/navigation";
import { Folder, Search, X } from "lucide-react";
import { useGenerations } from "@/hooks/useGenerations";
import { useSharedGenerations } from "@/hooks/useSharedGenerations";
import { useProjects } from "@/hooks/useProjects";
import { GenerationGrid } from "./GenerationGrid";
import { GridSizeSlider } from "./GridSizeSlider";
import { GalleryFilters, type GalleryFilterState } from "./GalleryFilters";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";

const TABS: { id: Category | "all" | "shared"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "3d", label: "3D" },
  { id: "shared", label: "Shared" },
];

export function GalleryView() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Category | "all" | "shared">("all");
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [projectId, setProjectId] = useState<string | null>(params.get("project"));
  const [filters, setFilters] = useState<GalleryFilterState>({});
  const { projects } = useProjects();

  const activeCategory = tab === "all" || tab === "shared" ? undefined : tab;
  const own = useGenerations(activeCategory, { projectId, search, ...filters });
  const shared = useSharedGenerations();

  async function refetchLatest() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    let query = supabase.from("generations").select("*").order("created_at", { ascending: false }).limit(1);
    if (activeCategory) query = query.eq("category", activeCategory);
    const { data } = await query;
    if (data?.[0]) {
      own.prepend(data[0] as never);
      own.pollNow(data[0].id);
    }
  }

  const isShared = tab === "shared";
  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-4">
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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 focus-within:border-accent transition-colors">
              <Search className="h-3.5 w-3.5 text-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts…"
                className="w-36 sm:w-48 bg-transparent text-xs outline-none placeholder:text-muted"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {!isShared && <GalleryFilters value={filters} onChange={setFilters} />}
            <GridSizeSlider value={colWidth} onChange={setColWidth} />
          </div>
        </div>

        {/* Project filter chips — Magnific-style sorting by project. */}
        {projects.length > 0 && !isShared && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setProjectId(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                !projectId
                  ? "border-accent/60 bg-accent/10 text-foreground"
                  : "border-border-subtle bg-surface text-muted hover:text-foreground"
              )}
            >
              All projects
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(projectId === p.id ? null : p.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  projectId === p.id
                    ? "border-accent/60 bg-accent/10 text-foreground"
                    : "border-border-subtle bg-surface text-muted hover:text-foreground"
                )}
              >
                <Folder className="h-3 w-3" style={{ color: p.color }} />
                {p.name}
              </button>
            ))}
            {activeProject && (
              <span className="text-xs text-muted">
                Showing “{activeProject.name}”
              </span>
            )}
          </div>
        )}

        {isShared ? (
          <GenerationGrid
            items={shared.items}
            loading={shared.loading}
            hasMore={shared.hasMore}
            onLoadMore={shared.loadMore}
            emptyLabel="Nothing shared with you yet — ask a friend to share a generation."
            onDeleted={shared.removeItem}
            columnWidth={colWidth}
            readOnly
          />
        ) : (
          <GenerationGrid
            items={own.items}
            loading={own.loading}
            hasMore={own.hasMore}
            onLoadMore={own.loadMore}
            emptyLabel={
              search || projectId
                ? "No generations match the current filters."
                : "Your full generation history will appear here — nothing is ever deleted automatically."
            }
            onToolRun={refetchLatest}
            onDeleted={own.removeItem}
            columnWidth={colWidth}
          />
        )}
      </div>
    </div>
  );
}
