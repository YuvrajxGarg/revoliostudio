"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Aperture,
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Building2,
  Car,
  Check,
  CloudLightning,
  CloudRain,
  Coffee,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Crop,
  Droplet,
  Eraser,
  Eye,
  Feather,
  FileImage,
  Flame,
  Focus,
  Frame,
  Gamepad2,
  Gauge,
  GitCommitHorizontal,
  Heart,
  Hourglass,
  Image as ImageIcon,
  Laugh,
  Mic2,
  Moon,
  Mountain,
  Newspaper,
  Package,
  Paintbrush,
  Palette,
  Play,
  RefreshCw,
  Rocket,
  RotateCw,
  Scissors,
  Shield,
  Smartphone,
  Smile,
  Spade,
  Sparkles,
  Star,
  Sunset,
  Timer,
  Tv,
  Truck,
  Music,
  UserRound,
  Users,
  UtensilsCrossed,
  Vibrate,
  Waves,
  Wind,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getModel, type Category } from "@/lib/models";
import { useComposerStore } from "@/store/composerStore";
import { PRESET_TEMPLATES, type PresetTemplate } from "@/lib/presets";
import { LazyPreviewVideo } from "@/components/ui/LazyPreviewVideo";
import { usePresetOverrides } from "@/hooks/usePresetOverrides";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PresetPromptEditModal } from "@/components/templates/PresetPromptEditModal";
import { Pencil } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ZoomIn,
  RotateCw,
  ArrowUp,
  Gauge,
  Users,
  Music,
  RefreshCw,
  Smartphone,
  Crop,
  Eraser,
  GitCommitHorizontal,
  Frame,
  ArrowLeftRight,
  Package,
  Image: ImageIcon,
  Scissors,
  Sparkles,
  // ── Viral/social template icons ──────────────────────────────────────
  Shield,
  Car,
  Heart,
  Gamepad2,
  Smile,
  Waves,
  CloudRain,
  CloudLightning,
  Sunset,
  Mountain,
  BookOpen,
  Paintbrush,
  Moon,
  Droplet,
  Palette,
  Tv,
  Newspaper,
  FileImage,
  Coffee,
  Laugh,
  Flame,
  Spade,
  UtensilsCrossed,
  Star,
  Mic2,
  Building2,
  Truck,
  // ── Motion Control (camera-move vocabulary) icons ──────────────────────
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Aperture,
  Vibrate,
  CornerUpLeft,
  CornerUpRight,
  Compass,
  Focus,
  Rocket,
  Wind,
  UserRound,
  Eye,
  Feather,
  Hourglass,
  Timer,
};

function PresetIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}

function PresetCard({
  preset,
  onUse,
  isAdmin,
  onEditPrompt,
}: {
  preset: PresetTemplate;
  onUse: (preset: PresetTemplate) => void;
  isAdmin?: boolean;
  onEditPrompt?: (preset: PresetTemplate) => void;
}) {
  const [justUsed, setJustUsed] = useState(false);

  function handleUse() {
    setJustUsed(true);
    onUse(preset);
    window.setTimeout(() => setJustUsed(false), 1100);
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface hover:border-accent/50 transition-colors">
      <div className="relative flex aspect-video w-full items-center justify-center accent-gradient opacity-90 overflow-hidden">
        {isAdmin && preset.prompt && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditPrompt?.(preset);
            }}
            title="View/edit prompt (admin only)"
            className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/70"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {preset.previewGif ? (
          // Self-hosted, hand-picked GIF with the effect name baked into
          // the frame — animates natively as a plain <img>, no <video>
          // element needed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preset.previewGif} alt={preset.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : preset.previewVideo ? (
          // Stock preview clip (Pexels, free license) instead of the
          // icon+gradient placeholder — autoplays muted/looped like a GIF.
          // Lazy: only fetches/plays once scrolled near-viewport, since the
          // "All" filter here can render 100+ cards at once.
          <LazyPreviewVideo
            src={preset.previewVideo}
            poster={preset.previewImage}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : preset.previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preset.previewImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <PresetIcon name={preset.icon} className="h-8 w-8 text-white/90" />
        )}
        {preset.badge && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {preset.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="text-sm font-medium">{preset.title}</div>
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{preset.description}</p>
      </div>
      <div className="p-3 pt-0">
        <button
          onClick={handleUse}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-200",
            justUsed ? "scale-[1.03] bg-emerald-500" : "bg-accent hover:bg-accent-2"
          )}
        >
          {justUsed ? (
            <>
              <Check className="h-3.5 w-3.5" /> Added
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Use template
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Curated "Featured templates" grid — admin-curated presets on verified
 * models, with group-tab filtering. Shared between the standalone
 * `/templates` page (`TemplatesGallery`) and each studio's "My templates"
 * tab (e.g. `VideoStudioView`), so both surfaces show the same set instead
 * of drifting into two implementations.
 */
export function FeaturedTemplatesGrid({ category }: { category: Category }) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const { setCategory: setComposerCategory, setModelId, setActivePreset, updateSettings, resetAfterSubmit } =
    useComposerStore();
  // Admin-edited prompt overrides (edited in place via the hover "Edit
  // prompt" button below) — sparse map, falls back to each preset's own
  // hardcoded prompt when absent. `localOverrides` layers on top so a save/
  // reset made in this session reflects instantly without waiting on a
  // refetch of the shared, cached `usePresetOverrides` map.
  const promptOverrides = usePresetOverrides();
  const [localOverrides, setLocalOverrides] = useState<Record<string, string | null>>({});
  const isAdmin = useIsAdmin();
  const [editingPreset, setEditingPreset] = useState<PresetTemplate | null>(null);

  const effectiveOverride = (presetId: string): string | undefined => {
    if (presetId in localOverrides) return localOverrides[presetId] ?? undefined;
    return promptOverrides[presetId];
  };

  const inCategory = useMemo(() => PRESET_TEMPLATES.filter((p) => p.studioCategory === category), [category]);
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const p of inCategory) {
      if (!seen.has(p.group)) {
        seen.add(p.group);
        order.push(p.group);
      }
    }
    return order;
  }, [inCategory]);
  const filtered = activeGroup === "all" ? inCategory : inCategory.filter((p) => p.group === activeGroup);

  function useTemplate(preset: PresetTemplate) {
    const model = getModel(preset.modelId);
    if (!model) return;

    const activePreset = {
      id: preset.id,
      title: preset.title,
      prompt: effectiveOverride(preset.id) ?? preset.prompt ?? "",
      previewVideo: preset.previewVideo,
      previewImage: preset.previewImage,
      group: preset.group,
    };

    // "Edit Video" (v2v) and "Motion Control" tabs manage their own local
    // state rather than the shared composer store, so they're preloaded via
    // URL params instead; every other tab/category reads composerStore.
    // The preset itself still goes into composerStore (category stays
    // "video" throughout, only the sub-tab changes) so EditVideoComposer can
    // render the same active-preset preview card.
    if (preset.studioCategory === "video" && (preset.tab === "edit" || preset.tab === "motion")) {
      setActivePreset(activePreset);
      const params = new URLSearchParams({ tab: preset.tab, model: preset.modelId });
      router.push(`/studio/video?${params.toString()}`);
      return;
    }

    resetAfterSubmit();
    setComposerCategory(preset.studioCategory);
    setModelId(preset.modelId);
    setActivePreset(activePreset);
    if (preset.settings) updateSettings(preset.settings);
    router.push(`/studio/${preset.studioCategory}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Featured templates</h2>
        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 w-fit flex-wrap">
          <button
            onClick={() => setActiveGroup("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeGroup === "all" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeGroup === g ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            onUse={useTemplate}
            isAdmin={isAdmin}
            onEditPrompt={setEditingPreset}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-muted">
            No featured templates for this category yet.
          </div>
        )}
      </div>

      {editingPreset && (
        <PresetPromptEditModal
          preset={editingPreset}
          currentPrompt={effectiveOverride(editingPreset.id) ?? editingPreset.prompt ?? ""}
          hasOverride={effectiveOverride(editingPreset.id) !== undefined}
          onClose={() => setEditingPreset(null)}
          onSaved={(prompt) => {
            setLocalOverrides((prev) => ({ ...prev, [editingPreset.id]: prompt }));
            setEditingPreset(null);
          }}
          onReset={() => {
            setLocalOverrides((prev) => ({ ...prev, [editingPreset.id]: null }));
            setEditingPreset(null);
          }}
        />
      )}
    </div>
  );
}
