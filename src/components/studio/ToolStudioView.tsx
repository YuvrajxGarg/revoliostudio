"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronLeft,
  Contact,
  Crop,
  Grid3x3,
  Maximize2,
  Package,
  PenTool,
  Sticker,
  Sun,
  UserRound,
  Wand2,
} from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useGenerations } from "@/hooks/useGenerations";
import { useComposerStore } from "@/store/composerStore";
import { PromptComposer } from "@/components/composer/PromptComposer";
import { EditVideoComposer } from "@/components/composer/EditVideoComposer";
import { RelightComposer } from "@/components/composer/RelightComposer";
import { AngleComposer } from "@/components/composer/AngleComposer";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { GalleryToolbar } from "@/components/gallery/GalleryToolbar";
import type { GalleryFilterState } from "@/components/gallery/GalleryFilters";
import { cn } from "@/lib/utils";
import { getModel, type ModelConfig } from "@/lib/models";
import { getToolStudio } from "@/lib/toolStudios";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UserRound,
  Contact,
  PenTool,
  Wand2,
  Package,
  Crop,
  Maximize2,
  Sticker,
  Sun,
  Camera,
};

// Tools whose UI can't be expressed as a PromptComposer config (a rich
// interactive preview instead of a text box) get a bespoke composer here,
// keyed by tool id — same idea as `needsVideoUpload` below, just for
// per-tool rather than per-model overrides. Add new bespoke tools by
// registering their composer here instead of growing another ternary.
const BESPOKE_COMPOSERS: Record<
  string,
  React.ComponentType<{ models: ModelConfig[]; onGenerated?: () => void }>
> = {
  relight: RelightComposer,
  angle: AngleComposer,
};

/**
 * Shared renderer for every config-driven "single-purpose tool" in
 * `src/lib/toolStudios.ts`. Deliberately built on the same PromptComposer /
 * GenerationGrid / useGenerations plumbing as the main Image/Video studios
 * (see StudioView.tsx) rather than a bespoke one-shot flow like Typography
 * Slate — that's what gets every tool a real gallery and concurrent
 * generation (the composer never blocks the UI while a job runs) for free.
 */
export function ToolStudioView({ toolId }: { toolId: string }) {
  const router = useRouter();
  const tool = getToolStudio(toolId);
  const [activeTabId, setActiveTabId] = useState(tool?.tabs[0]?.id ?? "");
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GalleryFilterState>({});
  const { resetAfterSubmit, setPrompt, updateSettings } = useComposerStore();

  const activeTab = tool?.tabs.find((t) => t.id === activeTabId) ?? tool?.tabs[0];

  // Scoped by tool_id (which surface actually created the row), not by
  // model id — several tools intentionally reuse the same underlying
  // models as the plain Image/Video Generator (and as each other), so
  // filtering by modelIds alone let one tool's output bleed into every
  // other surface that happens to share a model. See
  // supabase/migrations/0019_tool_scoping_and_audio.sql.
  const { items, loading, hasMore, loadMore, prepend, removeItem, pollNow } = useGenerations(undefined, {
    search,
    ...filters,
    toolId: tool?.id,
  });

  // Fresh slate every time this tool (or one of its tabs) is entered —
  // clears any prompt/reference left over from a different tool (they share
  // one global composer store) and seeds the curated default instruction,
  // if this tool has one, so it's visible and editable right away.
  useEffect(() => {
    if (!tool) return;
    resetAfterSubmit();
    setPrompt(tool.defaultPrompt ?? "");
    if (tool.defaultSettings) updateSettings(tool.defaultSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id, activeTabId]);

  async function refetchLatest() {
    if (!tool) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("tool_id", tool.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) {
      prepend(data[0] as never);
      pollNow(data[0].id);
    }
  }

  if (!tool || !activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted">Tool not found.</div>
    );
  }

  const Icon = ICONS[tool.icon] ?? Grid3x3;

  // Models that take a whole video file (v2v edits, video enhance/upscale)
  // have no upload affordance in PromptComposer — it's image-reference
  // only. Those tabs get EditVideoComposer instead, same as the main Video
  // studio's own "Edit Video" tab, scoped down to just this tool's models.
  const activeTabModels = activeTab.modelIds.map(getModel).filter((m): m is NonNullable<typeof m> => !!m);
  const needsVideoUpload = activeTabModels.some((m) => m.requiresVideoInput);
  const BespokeComposer = BESPOKE_COMPOSERS[tool.id];

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 px-3 pb-3 pt-3">
      {/* Banner header — Community-style: icon chip + title + tagline,
          centered to the same max-width the two-panel body below uses, so
          on wide screens this doesn't stretch edge-to-edge. Always visible
          (shrink-0), which is why the aside/gallery headers below no longer
          repeat the tool's icon/title/description themselves. */}
      <div className="mx-auto w-full max-w-6xl shrink-0">
        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{tool.title}</h1>
            <p className="mt-0.5 truncate text-xs text-muted">{tool.description}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 gap-4">
      {/* Left control panel. Project selector lives in the TopNav so it
          costs no vertical space here. */}
      <aside className="hidden lg:flex w-[320px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-subtle/60 p-3.5 shrink-0">
          <button
            onClick={() => router.push("/home")}
            title="Back to Home"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-muted">Back to Home</span>
        </div>

        {tool.tabs.length > 1 && (
          <div className="flex items-center gap-1 p-2 border-b border-border-subtle/60 shrink-0">
            {tool.tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTabId(t.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  activeTab.id === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {activeTab.referenceHint && <p className="text-[11px] text-muted -mb-1">{activeTab.referenceHint}</p>}

          {tool.stylePresets && tool.stylePresets.length > 0 && (
            <div>
              <div className="panel-label mb-1.5">Style</div>
              <div className="flex flex-wrap gap-1.5">
                {tool.stylePresets.map((sp) => (
                  <button
                    key={sp.label}
                    onClick={() => setPrompt(sp.prompt)}
                    className="rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:border-accent/50 hover:text-foreground transition-colors"
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {BespokeComposer ? (
            <BespokeComposer key={`${tool.id}-${activeTab.id}`} models={activeTabModels} onGenerated={refetchLatest} />
          ) : needsVideoUpload ? (
            <EditVideoComposer
              key={`${tool.id}-${activeTab.id}`}
              models={activeTabModels}
              onGenerated={refetchLatest}
              toolId={tool.id}
            />
          ) : (
            <PromptComposer
              key={`${tool.id}-${activeTab.id}`}
              category={activeTab.category}
              variant="sidebar"
              modelFilter={(m) => activeTab.modelIds.includes(m.id)}
              onGenerated={refetchLatest}
              placeholder={tool.promptPlaceholder}
              transformPrompt={tool.promptTransform}
              toolId={tool.id}
            />
          )}
        </div>
      </aside>

      {/* Main stage — this tool's own gallery, scoped to its tool_id. Icon/
          title dropped from this header (now redundant with the banner
          above) — just the search/filter/grid-size controls remain. */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-end gap-2 px-5 md:px-6 py-3.5 border-b border-border-subtle/60 shrink-0">
          <GalleryToolbar search={search} onSearch={setSearch} filters={filters} onFilters={setFilters} showTool={false} />
          {items.length > 0 && <GridSizeSlider value={colWidth} onChange={setColWidth} />}
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-32 lg:pb-5">
          <GenerationGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyLabel={tool.emptyLabel}
            onToolRun={refetchLatest}
            onDeleted={removeItem}
            columnWidth={colWidth}
          />
        </div>
      </div>
      </div>

      {/* Fallback composer for narrow screens where the sidebar is hidden. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto border-t border-border-subtle bg-background/95 backdrop-blur px-4 py-3 z-10">
        <div className="mx-auto max-w-3xl">
          {BespokeComposer ? (
            <BespokeComposer
              key={`${tool.id}-${activeTab.id}-bottom`}
              models={activeTabModels}
              onGenerated={refetchLatest}
            />
          ) : needsVideoUpload ? (
            <EditVideoComposer
              key={`${tool.id}-${activeTab.id}-bottom`}
              models={activeTabModels}
              onGenerated={refetchLatest}
              toolId={tool.id}
            />
          ) : (
            <PromptComposer
              key={`${tool.id}-${activeTab.id}-bottom`}
              category={activeTab.category}
              variant="bottom"
              modelFilter={(m) => activeTab.modelIds.includes(m.id)}
              onGenerated={refetchLatest}
              placeholder={tool.promptPlaceholder}
              transformPrompt={tool.promptTransform}
              toolId={tool.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
