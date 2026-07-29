"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Box,
  Clapperboard,
  Image as ImageIcon,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationCard } from "@/components/gallery/GenerationCard";
import { ProjectsCard } from "@/components/projects/ProjectsCard";
import { CommandPalette } from "@/components/home/CommandPalette";
import { RELEASE_NOTES } from "@/lib/releaseNotes";
import { randomTip } from "@/lib/tips";
import { pickGreeting } from "@/lib/greetings";
import { ALL_TOOLS } from "@/lib/tools";
import { TOOL_ICON_MAP } from "@/lib/toolIcons";
import { getToolUsageCounts } from "@/lib/recentTools";
import { PRESET_TEMPLATES, type PresetTemplate } from "@/lib/presets";
import { LazyPreviewVideo } from "@/components/ui/LazyPreviewVideo";
import { useComposerStore } from "@/store/composerStore";
import { getModel } from "@/lib/models";
import { useUserReferences } from "@/hooks/useUserReferences";

// Code-split — nontrivial flyout UI (search, category tabs, pin toggles)
// only needed once someone actually opens the Tools section's "All tools"
// link below.
const ToolDrawer = dynamic(() => import("@/components/layout/ToolDrawer").then((m) => m.ToolDrawer), { ssr: false });

interface HomeTile {
  href: string;
  label: string;
  icon: typeof ImageIcon;
  tint: string;
}

// Just the five most-reached-for destinations — Gallery, Projects, Library,
// Templates, Resources, and All tools all have their own dedicated sections
// further down the page now, so repeating them as tiles up here too was
// redundant.
const TILES: HomeTile[] = [
  { href: "/studio/image", label: "Image", icon: ImageIcon, tint: "#e85002" },
  { href: "/studio/video", label: "Video", icon: Clapperboard, tint: "#4285f4" },
  { href: "/studio/audio", label: "Audio", icon: AudioLines, tint: "#10a37f" },
  { href: "/studio/3d", label: "3D", icon: Box, tint: "#7c5cff" },
  { href: "/autopilot", label: "Pilot", icon: Bot, tint: "#e8a202" },
];

// The "custom", single-purpose tool studios — Thumbnail Generator, Upscale,
// Character, etc. — as opposed to the four core generation studios
// (Image/Video/Audio/3D, already their own big tiles above) or the
// Content-group pages (Gallery/Projects/Library/Resources/Templates).
// Deliberately independent of sidebar pin state — a tool being hidden from
// the sidebar shouldn't also hide it from this discovery section.
const CORE_STUDIO_HREFS = new Set(["/studio/image", "/studio/video", "/studio/audio", "/studio/3d"]);
const CUSTOM_TOOLS = ALL_TOOLS.filter((t) => t.group === "Studios" && !CORE_STUDIO_HREFS.has(t.href));

// Same tint palette as the studio tiles above, keyed by a generation's own
// `category` — used for the small corner badge on each Recent work card so
// the grid reads at a glance without opening anything.
const CATEGORY_META: Record<string, { icon: typeof ImageIcon; tint: string }> = {
  image: { icon: ImageIcon, tint: "#e85002" },
  video: { icon: Clapperboard, tint: "#4285f4" },
  audio: { icon: AudioLines, tint: "#10a37f" },
  "3d": { icon: Box, tint: "#7c5cff" },
};

/**
 * Magnific-style home: a big friendly greeting, one search bar, tool
 * tiles, your most recent work, and what's new — everything one click away.
 */
export function HomeDashboard({
  displayName,
  email,
}: {
  displayName: string | null;
  email: string;
}) {
  const recent = useGenerations(undefined);
  const firstName = (displayName || email.split("@")[0] || "").split(" ")[0];
  const latestNotes = RELEASE_NOTES.slice(0, 3);
  // Picked client-side only, after mount. Math.random() during the
  // initializer would otherwise pick one tip during the server render and
  // a different one during client hydration (Home is server-rendered) —
  // a real server/client mismatch on every load, and the only
  // non-deterministic render in the app (every other page renders
  // identically server vs client). Starting from `null` and filling it in
  // via an effect keeps the server and first client render identical, so
  // there's nothing for React to reconcile/redo.
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => setTip(randomTip()), []);
  // Same reasoning as `tip` above, plus one more wrinkle: the server
  // (Vercel, UTC) and the browser (the user's own timezone) don't agree on
  // "what hour is it" either, so picking the greeting during render — as
  // the old static `greeting()` helper did — could SSR one greeting and
  // hydrate a different one. Starting from `null` and filling it in after
  // mount sidesteps both mismatches in one move.
  const [greetingLine, setGreetingLine] = useState<string | null>(null);
  useEffect(() => setGreetingLine(pickGreeting(new Date().getHours(), firstName)), [firstName]);
  const [toolsSectionDrawerOpen, setToolsSectionDrawerOpen] = useState(false);
  const toolsSectionRef = useRef<HTMLButtonElement>(null);

  const router = useRouter();
  const { setCategory, setModelId, setActivePreset, updateSettings, resetAfterSubmit } = useComposerStore();
  const { references: libraryRefs, loading: libraryLoading } = useUserReferences();

  // Usage counts live in localStorage (see recordToolUse in recentTools.ts,
  // recorded on every tool visit) — read only after mount, same reasoning as
  // `tip` above: reading localStorage during the initial render would differ
  // between server and client and cause a hydration mismatch. `null` means
  // "not read yet", not "no usage" — the fallback order below only kicks in
  // once we actually know there's nothing recorded.
  const [usageCounts, setUsageCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => setUsageCounts(getToolUsageCounts()), []);

  // Ranked by actual usage (most-opened first) once we have that data;
  // ties — including a brand-new user with zero recorded visits — fall back
  // to CUSTOM_TOOLS' own curated declaration order, since Array.sort is
  // stable. Independent of sidebar pin state entirely.
  const toolsPreview = useMemo(() => {
    if (!usageCounts || Object.keys(usageCounts).length === 0) return CUSTOM_TOOLS.slice(0, 8);
    return [...CUSTOM_TOOLS]
      .sort((a, b) => (usageCounts[b.href] ?? 0) - (usageCounts[a.href] ?? 0))
      .slice(0, 8);
  }, [usageCounts]);

  // A small curated slice of Featured Templates with real preview media —
  // picked across categories rather than just taking the first N in
  // declaration order, so this doesn't read as "every camera move".
  const templatesPreview = useMemo(() => {
    const withPreview = PRESET_TEMPLATES.filter((p) => p.previewVideo || p.previewGif || p.previewImage);
    const seen = new Set<string>();
    const out: PresetTemplate[] = [];
    for (const p of withPreview) {
      if (out.length >= 6) break;
      if (seen.has(p.group)) continue;
      seen.add(p.group);
      out.push(p);
    }
    // Fewer than 5 groups have preview media — top up from whatever's left.
    for (const p of withPreview) {
      if (out.length >= 6) break;
      if (!out.includes(p)) out.push(p);
    }
    return out;
  }, []);

  // Mirrors FeaturedTemplatesGrid's `useTemplate` — applying a template from
  // Home should behave identically to applying it from the Templates page.
  function applyTemplate(preset: PresetTemplate) {
    const model = getModel(preset.modelId);
    if (!model) return;
    const activePreset = {
      id: preset.id,
      title: preset.title,
      prompt: preset.prompt ?? "",
      previewVideo: preset.previewVideo,
      previewImage: preset.previewImage,
      group: preset.group,
    };
    if (preset.studioCategory === "video" && (preset.tab === "edit" || preset.tab === "motion")) {
      setActivePreset(activePreset);
      const params = new URLSearchParams({ tab: preset.tab, model: preset.modelId });
      router.push(`/studio/video?${params.toString()}`);
      return;
    }
    resetAfterSubmit();
    setCategory(preset.studioCategory);
    setModelId(preset.modelId);
    setActivePreset(activePreset);
    if (preset.settings) updateSettings(preset.settings);
    router.push(`/studio/${preset.studioCategory}`);
  }

  function shuffleTip() {
    setTip((current) => {
      let next = randomTip();
      // Avoid landing on the exact same tip twice in a row when there's
      // more than one to pick from.
      let attempts = 0;
      while (next === current && attempts < 5) {
        next = randomTip();
        attempts++;
      }
      return next;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-10 flex flex-col gap-8">
        <div className="text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            {greetingLine ?? (firstName ? `Welcome back, ${firstName}` : "Welcome back")}
          </h1>
        </div>

        <div className="mx-auto w-full max-w-2xl">
          <CommandPalette />
        </div>

        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="panel-label">Tip of the day</div>
              <p className="mt-1 text-sm text-foreground leading-relaxed">{tip}</p>
            </div>
            <button
              onClick={shuffleTip}
              title="Show another tip"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-center gap-3 sm:gap-5 flex-wrap">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="group flex flex-col items-center gap-2">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface transition-transform group-hover:-translate-y-0.5"
                style={{ boxShadow: `inset 0 0 0 9999px ${t.tint}14` }}
              >
                <t.icon className="h-5 w-5" style={{ color: t.tint }} />
              </span>
              <span className="text-xs font-medium text-muted group-hover:text-foreground">{t.label}</span>
            </Link>
          ))}
        </div>

        {/* Tools — a few of your pinned studios/shortcuts, with a link to
            the full "All tools" drawer for everything else. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Tools</h2>
            <div className="relative">
              <button
                ref={toolsSectionRef}
                onClick={() => setToolsSectionDrawerOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
              >
                All tools <ArrowRight className="h-3 w-3" />
              </button>
              {toolsSectionDrawerOpen && (
                <ToolDrawer anchorRef={toolsSectionRef} onClose={() => setToolsSectionDrawerOpen(false)} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {toolsPreview.map((tool) => {
              const Icon = TOOL_ICON_MAP[tool.icon] ?? Sparkles;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-center gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3 transition-colors hover:border-accent/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground transition-colors group-hover:bg-accent/10 group-hover:text-accent">
                    <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{tool.label}</span>
                    <span className="block truncate text-xs text-muted">{tool.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Templates — a handful of Featured Templates, applying one jumps
            straight into the right studio with its model/prompt preloaded,
            same as clicking "Use template" on the Templates page itself. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Templates</h2>
            <Link href="/templates" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
              Browse all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {templatesPreview.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyTemplate(preset)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
              >
                <div className="relative aspect-video w-full overflow-hidden accent-gradient">
                  {preset.previewGif ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preset.previewGif} alt={preset.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : preset.previewVideo ? (
                    <LazyPreviewVideo
                      src={preset.previewVideo}
                      poster={preset.previewImage}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : preset.previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preset.previewImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-xs font-medium">{preset.title}</div>
                  <div className="truncate text-[11px] text-muted">{preset.group}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Magnific-style bounded panels: Projects | Recent work. */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 items-stretch">
          <ProjectsCard />
          <div className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface p-4">
            <div className="flex items-center justify-between pb-3">
              <Link href="/gallery" className="flex items-center gap-1 text-sm font-medium hover:text-accent">
                Recent work <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/gallery" className="text-xs text-muted hover:text-foreground">
                My work
              </Link>
            </div>
            {recent.loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl shimmer" />
                ))}
              </div>
            ) : recent.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center text-muted">
                <p className="text-sm">Nothing here yet. Pick a tool above and make something.</p>
              </div>
            ) : (
              // Boxed preview cards — a uniform grid with a real gap and a
              // bigger radius per card (rather than the Gallery's tightly
              // packed justified-rows masonry), so this reads as a set of
              // distinct tiles at a glance, Magnific-style. Each tile still
              // wraps the real GenerationCard so opening it, the hover
              // toolbar, and deletion all work exactly like every other
              // gallery in the app.
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {recent.items.slice(0, 8).map((item) => {
                  const meta = CATEGORY_META[item.category];
                  return (
                    <div
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-surface-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
                    >
                      <GenerationCard generation={item} fill onDeleted={recent.removeItem} />
                      {meta && (
                        <span
                          className="pointer-events-none absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md backdrop-blur-sm"
                          style={{ backgroundColor: `${meta.tint}cc` }}
                        >
                          <meta.icon className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Library — a preview of the user's saved Style/Character/Location/
            Element references, since these otherwise only ever show up
            inside a composer's reference picker. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Library</h2>
            <Link href="/library" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
              Open Library <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {libraryLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl shimmer" />
              ))}
            </div>
          ) : libraryRefs.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-8 text-center text-sm text-muted">
              No saved references yet. Save a Style, Character, Location or Element from any generation and it&apos;ll show up here.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {libraryRefs.slice(0, 8).map((ref) => (
                <Link
                  key={ref.id}
                  href="/library"
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-surface-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.image_url} alt={ref.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <span className="block truncate text-[11px] font-medium text-white">{ref.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">What&apos;s new</h2>
            <Link href="/release-notes" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
              All release notes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {latestNotes.map((note) => (
              <Link
                key={note.version}
                href="/release-notes"
                className="rounded-2xl border border-border-subtle bg-surface p-4 hover:border-accent/50 transition-colors"
              >
                <div className="panel-label">{note.version} · {note.tag}</div>
                <div className="mt-1 text-sm font-medium">{note.title}</div>
                <div className="mt-1 text-xs text-muted line-clamp-2">{note.highlights[0] ?? ""}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
