"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Clapperboard, LayoutGrid, LayoutTemplate, List, Loader2, Move, Sparkles, Wand2 } from "lucide-react";
import { useGenerations } from "@/hooks/useGenerations";
import { VideoHistoryFeed } from "@/components/gallery/VideoHistoryFeed";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { TryExampleButton } from "@/components/gallery/TryExampleButton";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { GalleryToolbar } from "@/components/gallery/GalleryToolbar";
import type { GalleryFilterState } from "@/components/gallery/GalleryFilters";
import { PromptComposer } from "@/components/composer/PromptComposer";
import { EditVideoComposer } from "@/components/composer/EditVideoComposer";
import { MotionControlComposer } from "@/components/composer/MotionControlComposer";
import { cn } from "@/lib/utils";
import { StudioTabs } from "./StudioTabs";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import { SaveTemplateButton } from "@/components/templates/SaveTemplateButton";
import { TemplatesPanel } from "@/components/templates/TemplatesPanel";
import { FeaturedTemplatesGrid } from "@/components/templates/FeaturedTemplatesGrid";
import { useComposerStore } from "@/store/composerStore";

type Tab = "create" | "edit" | "motion";
type HistoryView = "list" | "grid";
type MainTab = "creations" | "templates";

const TABS: { id: Tab; label: string; icon: typeof Clapperboard }[] = [
  { id: "create", label: "Create Video", icon: Clapperboard },
  { id: "edit", label: "Edit Video", icon: Wand2 },
  { id: "motion", label: "Motion Control", icon: Move },
];

const EMPTY_LABEL = "No videos yet — describe a scene, or animate a reference image.";

export function VideoStudioView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("create");
  const [mainTab, setMainTab] = useState<MainTab>("creations");
  // Key bumped to -v2 so the default flips to "grid" (the primary video view
  // now) for everyone, including anyone whose old saved preference was "list".
  const [historyView, setHistoryView] = usePersistentState<HistoryView>("revolio-video-history-view-v2", "grid");
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GalleryFilterState>({});
  const projectId = useComposerStore((st) => st.projectId);
  // tool_id IS NULL — keeps output from tool studios that share video
  // models (Reframe, Upscale) out of the plain Video Generator's gallery.
  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations("video", {
    projectId,
    search,
    ...filters,
    toolId: null,
  });

  // Arriving from the Templates page — e.g. /studio/video?tab=edit&model=
  // kling-v3-pro-motion-control&prompt=... — jump straight to the right tab
  // with the preset preloaded, rather than dropping the user on "Create
  // Video" with no idea which model/tab the template needed.
  const presetTab = searchParams.get("tab");
  const presetModel = searchParams.get("model");
  const presetPrompt = searchParams.get("prompt");
  useEffect(() => {
    if (presetTab === "edit" || presetTab === "motion" || presetTab === "create") {
      setTab(presetTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTab, presetModel, presetPrompt]);

  async function refetchLatest() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("category", "video")
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
      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex flex-col gap-2 p-3 border-b border-border-subtle/60 shrink-0">
          <StudioTabs />
          <div className="flex items-center justify-between gap-2">
            <ProjectPicker />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => router.push("/templates")}
                title="Browse templates"
                className="icon-btn-round"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
              </button>
              <SaveTemplateButton category="video" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-2 border-b border-border-subtle/60 overflow-x-auto shrink-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tab === "create" && (
            <PromptComposer
              category="video"
              variant="sidebar"
              modelFilter={(m) => m.mode !== "v2v" && m.mode !== "motion"}
              onGenerated={refetchLatest}
            />
          )}
          {tab === "edit" && (
            <EditVideoComposer
              onGenerated={refetchLatest}
              initialModelId={presetModel ?? undefined}
              initialPrompt={presetPrompt ?? undefined}
            />
          )}
          {tab === "motion" && <MotionControlComposer onGenerated={refetchLatest} />}
        </div>
      </aside>

      <div className="flex-1 flex min-h-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
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
                {historyView === "grid" && items.length > 0 && (
                  <GridSizeSlider value={colWidth} onChange={setColWidth} />
                )}
                <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle p-0.5">
                  <button
                    onClick={() => setHistoryView("list")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                      historyView === "list" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    <List className="h-3.5 w-3.5" /> List
                  </button>
                  <button
                    onClick={() => setHistoryView("grid")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                      historyView === "grid" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Grid
                  </button>
                </div>
              </div>
            )}
          </div>

          {mainTab === "templates" ? (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-8 px-4 md:px-6 py-6">
                <div className="flex flex-col gap-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My templates</h2>
                  <TemplatesPanel category="video" />
                </div>
                <FeaturedTemplatesGrid category="video" />
              </div>
            </div>
          ) : historyView === "grid" ? (
            <div className="flex-1 overflow-y-auto p-4">
              <GenerationGrid
                items={items}
                loading={loading}
                hasMore={hasMore}
                onLoadMore={loadMore}
                emptyLabel={EMPTY_LABEL}
                emptyAction={<TryExampleButton category="video" />}
                onToolRun={refetchLatest}
                onDeleted={removeItem}
                columnWidth={colWidth}
              />
            </div>
          ) : loading && items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : (
            // Single scrollable column — no separate right-rail/preview
            // split. Matches Higgsfield's List view, where the history feed
            // itself is the only scroll region and each row carries its own
            // inline preview instead of driving a shared big-preview pane.
            <div className="flex-1 overflow-y-auto px-4 md:px-6">
              <VideoHistoryFeed
                items={items}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onToolRun={refetchLatest}
                onDeleted={removeItem}
                emptyLabel={EMPTY_LABEL}
                emptyAction={<TryExampleButton category="video" />}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fallback composer for narrow screens where the sidebar is hidden. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 shrink-0 border-t border-border-subtle bg-background/95 backdrop-blur px-4 py-3 z-10">
        <div className="mx-auto max-w-3xl">
          <PromptComposer category="video" variant="bottom" onGenerated={refetchLatest} />
        </div>
      </div>
    </div>
  );
}
