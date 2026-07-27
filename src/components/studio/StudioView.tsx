"use client";

import { useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LayoutTemplate, Sparkles } from "lucide-react";
import { PromptComposer } from "@/components/composer/PromptComposer";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { TryExampleButton } from "@/components/gallery/TryExampleButton";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { GalleryToolbar } from "@/components/gallery/GalleryToolbar";
import type { GalleryFilterState } from "@/components/gallery/GalleryFilters";
import { TemplatesPanel } from "@/components/templates/TemplatesPanel";
import { FeaturedTemplatesGrid } from "@/components/templates/FeaturedTemplatesGrid";
import { SaveTemplateButton } from "@/components/templates/SaveTemplateButton";
import { StudioTabs } from "./StudioTabs";
import { useGenerations } from "@/hooks/useGenerations";
import { useComposerStore } from "@/store/composerStore";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";

const EMPTY_LABELS: Record<Category, string> = {
  image: "No images yet — describe what you want in the panel and hit Generate.",
  video: "No videos yet — describe a scene, or animate a reference image.",
  audio: "No audio yet — audio generation appears here as soon as it runs.",
  "3d": "No 3D models yet — describe an object or turn an image into a mesh.",
};

const PANEL_TITLES: Record<Category, string> = {
  image: "Image Generator",
  video: "Video Generator",
  audio: "Audio Generator",
  "3d": "3D Studio",
};

type MainTab = "creations" | "templates";

/**
 * Magnific-style studio: media tabs on top of a fixed left control panel
 * (tool header, project chip, composer), and a main stage with
 * Creations / My templates tabs.
 */
export function StudioView({ category }: { category: Category }) {
  const router = useRouter();
  const projectId = useComposerStore((s) => s.projectId);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GalleryFilterState>({});
  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations(
    category,
    // tool_id IS NULL — keeps output from the config-driven tool studios
    // (Headshot, Sticker Pack, etc., which share several of these same
    // models) out of the plain generator's gallery. `toolId: null` is forced
    // last so the filter bar's spread can't override the scope.
    { projectId, search, ...filters, toolId: null }
  );
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [mainTab, setMainTab] = useState<MainTab>("creations");

  async function refetchLatest() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("category", category)
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
      {/* Left control panel. The project selector lives up in the TopNav
          (see TopNav.tsx) rather than here, so it costs zero vertical space
          in this panel — the composer gets the full height. */}
      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/60 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border-subtle/60 p-3 shrink-0">
          <StudioTabs />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link href="/home" title="All tools" className="text-muted hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-sm font-semibold">{PANEL_TITLES[category]}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => router.push("/templates")} title="Browse templates" className="icon-btn-round">
                <LayoutTemplate className="h-3.5 w-3.5" />
              </button>
              <SaveTemplateButton category={category} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <PromptComposer category={category} variant="sidebar" onGenerated={refetchLatest} />
        </div>
      </aside>

      {/* Main stage */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle/60 shrink-0">
          <div className="flex items-center gap-1">
            {(
              [
                { id: "creations", label: "Creations", icon: Sparkles },
                { id: "templates", label: "My templates", icon: LayoutTemplate },
              ] as { id: MainTab; label: string; icon: typeof Sparkles }[]
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setMainTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    mainTab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          {mainTab === "creations" && (
            <div className="flex items-center gap-2">
              <GalleryToolbar search={search} onSearch={setSearch} filters={filters} onFilters={setFilters} showTool={false} />
              <GridSizeSlider value={colWidth} onChange={setColWidth} />
            </div>
          )}
        </div>

        {mainTab === "templates" ? (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-8 px-4 md:px-6 py-6">
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My templates</h2>
                <TemplatesPanel category={category} />
              </div>
              <FeaturedTemplatesGrid category={category} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4">
            <GenerationGrid
              items={items}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              emptyLabel={EMPTY_LABELS[category]}
              emptyAction={<TryExampleButton category={category} />}
              onToolRun={refetchLatest}
              onDeleted={removeItem}
              columnWidth={colWidth}
            />
          </div>
        )}
      </div>

      {/* Fallback composer for narrow screens where the sidebar is hidden. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 border-t border-border-subtle bg-background/95 backdrop-blur px-4 py-3 z-10">
        <div className="mx-auto max-w-3xl">
          <PromptComposer category={category} variant="bottom" onGenerated={refetchLatest} />
        </div>
      </div>
    </div>
  );
}
