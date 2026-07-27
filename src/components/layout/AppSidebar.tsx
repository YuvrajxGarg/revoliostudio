"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  Box,
  Clapperboard,
  ChevronDown,
  ChevronUp,
  Globe,
  Grid3x3,
  Image as ImageIcon,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Tooltip } from "@/components/ui/Tooltip";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { FeedbackButtons } from "@/components/feedback/FeedbackButtons";
import { useToolPinsStore } from "@/store/toolPinsStore";
import { ALL_TOOLS, type ToolEntry } from "@/lib/tools";
import { TOOL_ICON_MAP as TOOL_ICONS } from "@/lib/toolIcons";
import { pushRecentTool, recordToolUse } from "@/lib/recentTools";

// Code-split — the drawer (search, tabs, pin toggles, grid of every tool) is
// nontrivial UI that only ever renders once a user actually clicks "All
// tools", not on every single page load like the rest of this sidebar. No
// SSR needed either since it's purely an interactive flyout.
const ToolDrawer = dynamic(() => import("./ToolDrawer").then((m) => m.ToolDrawer), { ssr: false });

// Always offered in the "Create" quick-menu regardless of pin state — that
// menu is about starting a new generation, not sidebar navigation, so
// unpinning a studio from the sidebar shouldn't also hide it from Create.
// Deliberately just the four core generation studios — everything else
// (Typography, Thumbnail, Explainer, Browse Templates) is reachable from
// "All tools" instead, keeping this quick-menu short.
const CREATE_ITEMS = [
  { href: "/studio/image", label: "Image", icon: ImageIcon },
  { href: "/studio/video", label: "Video", icon: Clapperboard },
  { href: "/studio/audio", label: "Audio", icon: AudioLines },
  { href: "/studio/3d", label: "3D", icon: Box },
];

// Short, punchy hover blurbs for the sidebar's custom Tooltip — deliberately
// separate from ToolEntry.description (tools.ts), which is longer-form copy
// written for the Home page's tool cards. Falls back to the tool's own
// label if a href is ever missing here (e.g. a newly added tool), so a
// tooltip never renders blank. Keyed by href rather than added as a new
// ToolEntry field since this is only ever consumed here, in the sidebar.
const TOOLTIP_BLURBS: Record<string, string> = {
  "/studio/image": "Text-to-image AI",
  "/studio/video": "Text-to-video AI",
  "/studio/audio": "Music & audio",
  "/studio/3d": "2D to 3D",
  "/studio/typography": "Custom lettering",
  "/studio/thumbnail": "YouTube thumbnails",
  "/studio/explainer": "Script to video",
  "/autopilot": "Your AI copilot",
  "/home": "Your dashboard",
  "/gallery": "All your work",
  "/projects": "Organize your work",
  "/library": "Saved references",
  "/resources": "Editing toolkit",
  "/templates": "Motion presets",
  "/studio/character": "Consistent characters",
  "/studio/headshot": "Pro headshots",
  "/studio/logo": "Logos & wordmarks",
  "/studio/restore": "Restore old photos",
  "/studio/product": "Studio product shots",
  "/studio/reframe": "Resize & crop",
  "/studio/upscale": "Sharper, higher-res",
  "/studio/stickers": "Sticker packs",
  "/studio/relight": "Change lighting",
  "/studio/angle": "New camera angles",
  "/explore": "Community showcase",
  "/spaces": "Visual workflows",
};

/**
 * One pinned-tool row. Draggable for reordering (see `reorderPinned` in
 * toolPinsStore.ts) — wrapped in a plain `<div draggable>` around the actual
 * `<Link>` rather than making the anchor itself draggable, which is the
 * usual way to avoid the browser's native "drag this link out as a URL"
 * affordance fighting with in-page reorder drags.
 */
function NavItem({
  href,
  label,
  description,
  icon: Icon,
  active,
  collapsed,
  draggable,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  href: string;
  label: string;
  /** Short (2-3 word) hover blurb — see TOOLTIP_BLURBS above. Shown instead
   * of the label when expanded (label's already visible as text); shown
   * instead of the old "Drag to reorder" native-title hint. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg transition-opacity",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isDropTarget && "ring-1 ring-inset ring-accent/60"
      )}
    >
      <Tooltip label={collapsed ? label : description}>
        <Link
          href={href}
          draggable={false}
          className={cn(
            "group flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors active:scale-[0.97]",
            collapsed ? "justify-center p-2" : "px-2.5 py-1.5",
            active ? "bg-accent/10 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
          )}
        >
          <Icon
            className={cn(
              "h-[15px] w-[15px] shrink-0 transition-transform duration-150 group-hover:scale-110",
              active && "text-accent"
            )}
          />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      </Tooltip>
    </div>
  );
}

/**
 * Magnific-style left navigation rail. Collapsible to an icon-only strip
 * (state persisted per browser). Both nav sections below (Workspace, then
 * Tools) are driven entirely by `useToolPinsStore` — unpinning a tool from
 * the "All tools" drawer removes it here; it's only reachable again by
 * reopening the drawer and pinning it back. Footer holds only:
 * notifications, "request a resource/feature", and "report a bug" — the
 * account menu lives top-right like the reference. Usage/Admin/Release notes
 * live in the top-right icon cluster (AccountBar) and the sidebar footer
 * respectively now, not as full nav rows here — see AccountBar.tsx.
 */
export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const navScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const pinnedHrefs = useToolPinsStore((s) => s.pinnedHrefs);
  const pinsHydrated = useToolPinsStore((s) => s.hasHydrated);
  const reorderPinned = useToolPinsStore((s) => s.reorderPinned);
  const [draggingHref, setDraggingHref] = useState<string | null>(null);
  const [dropTargetHref, setDropTargetHref] = useState<string | null>(null);

  // Don't derive the nav from `pinnedHrefs` until the persisted pin state
  // has actually loaded — the store's initial in-memory value is just
  // "every defaultPinned tool", a guess that's wrong for anyone who
  // unpinned one. Rendering that guess and then correcting it a tick later
  // is exactly what caused an unpinned tool (e.g. Typography Generator) to
  // visibly flash in the sidebar before disappearing on refresh.
  //
  // Ordered by `pinnedHrefs` itself (not by ALL_TOOLS's fixed declaration
  // order) — this is what makes a freshly-pinned tool land at the END of
  // its section instead of wherever tools.ts happens to declare it, and
  // what makes drag-reordering (below) actually have a visible, persisted
  // effect.
  const toolByHref = new Map(ALL_TOOLS.map((t) => [t.href, t] as const));
  const workspaceTools: ToolEntry[] = pinsHydrated
    ? pinnedHrefs.map((h) => toolByHref.get(h)).filter((t): t is ToolEntry => !!t && t.group === "Workspace")
    : [];
  const studioTools: ToolEntry[] = pinsHydrated
    ? pinnedHrefs.map((h) => toolByHref.get(h)).filter((t): t is ToolEntry => !!t && t.group === "Studios")
    : [];
  // Gallery/Projects/Templates/Library/Resources — a second, labeled group
  // nested under "Tools" rather than mixed flat into the Studios list above.
  const contentTools: ToolEntry[] = pinsHydrated
    ? pinnedHrefs.map((h) => toolByHref.get(h)).filter((t): t is ToolEntry => !!t && t.group === "Content")
    : [];

  // Vertical counterpart to StudioTabs' horizontal scroll arrows — same
  // pattern (native scrollbar hidden via .no-scrollbar, small chevron
  // buttons drive scrollBy(), a ResizeObserver re-checks since pinning/
  // unpinning/reordering tools changes the scrollable content's height).
  function updateNavArrows() {
    const el = navScrollerRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }

  useEffect(() => {
    updateNavArrows();
    const el = navScrollerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(updateNavArrows);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [collapsed, workspaceTools.length, studioTools.length, contentTools.length, isAdmin]);

  function scrollNavBy(dir: 1 | -1) {
    navScrollerRef.current?.scrollBy({ top: dir * 120, behavior: "smooth" });
  }

  function dragHandlers(href: string) {
    return {
      draggable: true,
      isDragging: draggingHref === href,
      isDropTarget: dropTargetHref === href && draggingHref !== href,
      onDragStart: (e: React.DragEvent) => {
        setDraggingHref(href);
        e.dataTransfer.effectAllowed = "move";
        // Firefox requires setData to be called for the drag to actually start.
        e.dataTransfer.setData("text/plain", href);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTargetHref(href);
        if (draggingHref && draggingHref !== href) reorderPinned(draggingHref, href);
      },
      onDragLeave: () => setDropTargetHref((v) => (v === href ? null : v)),
      onDrop: (e: React.DragEvent) => e.preventDefault(),
      onDragEnd: () => {
        setDraggingHref(null);
        setDropTargetHref(null);
      },
    };
  }

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("revolio-sidebar-collapsed") === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem("revolio-sidebar-collapsed", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
      // Drawer's own outside-click handling covers itself (it's portaled to
      // <body>, so it isn't a DOM descendant of toolsRef anymore).
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setCreateOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  // Feeds the Home command palette's "Recents" section, and Home's "Tools"
  // most-used ranking — recorded here (rather than per-page) since
  // AppSidebar is the one thing mounted on every (app) route already
  // tracking pathname.
  useEffect(() => {
    if (pathname && ALL_TOOLS.some((t) => t.href === pathname)) {
      pushRecentTool(pathname);
      recordToolUse(pathname);
    }
  }, [pathname]);

  return (
    <aside
      className={cn(
        // relative z-40: gives the sidebar its own stacking context so its
        // dropdowns/tooltips reliably paint above ordinary page content —
        // without it, an un-stacking-context'd <aside> lets same-or-higher
        // z-index elements elsewhere on the page (e.g. composer popovers)
        // win ties by DOM order, since they render after the sidebar.
        // min-h-0: without this, this flex item's default min-height:auto
        // can let its own box grow taller than the stretched h-screen size
        // when there are enough pinned tools to overflow — the inner
        // scroll region below relies on this being properly capped first.
        "hidden md:flex relative z-40 min-h-0 shrink-0 flex-col gap-1 border-r border-border-subtle/60 bg-surface/40 backdrop-blur-md py-4 transition-[width] duration-200",
        collapsed ? "w-[64px] px-2" : "w-[210px] px-3"
      )}
    >
      <div className={cn("flex items-center pb-3", collapsed ? "flex-col gap-2" : "justify-between px-1.5")}>
        <Link href="/home" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-foreground" />
          {!collapsed && <span className="text-[15px] font-semibold tracking-tight">Revolio</span>}
        </Link>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="relative pb-3" ref={createRef}>
        <button
          onClick={() => setCreateOpen((v) => !v)}
          title="Create"
          className={cn(
            "flex items-center gap-2 rounded-lg bg-accent text-[13px] font-semibold text-white hover:bg-accent-2 transition-colors",
            collapsed ? "h-9 w-9 justify-center mx-auto" : "w-full px-3 py-2"
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "Create"}
        </button>
        {createOpen && (
          <div
            className={cn(
              "animate-menu-pop-in absolute top-full z-50 mt-1 rounded-xl border border-border-subtle bg-surface p-1 shadow-2xl",
              collapsed ? "left-0 w-44" : "left-0 w-full"
            )}
          >
            {CREATE_ITEMS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground transition-colors active:scale-[0.98] hover:bg-surface-2"
              >
                <t.icon className="h-4 w-4 text-muted transition-transform duration-150 group-hover:scale-110" />
                {t.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable middle — Workspace nav + Tools. Bounded to whatever
          space is left between the header/Create block above and the
          footer below (flex-1 + min-h-0), with the native scrollbar
          hidden and small chevron buttons driving scrollBy() instead —
          same pattern as StudioTabs' horizontal arrows, just vertical.
          Needed once enough tools are pinned that the list would
          otherwise overflow past the footer or get clipped outright. */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={navScrollerRef}
          onScroll={updateNavArrows}
          className="no-scrollbar flex h-full flex-col gap-1 overflow-y-auto scroll-smooth"
        >
      {/* Workspace nav — Home, then any pinned Workspace-group tool (Pilot
          lives here too once pinned), plus Community as a fixed peer item so
          it shares the gap-0.5 rhythm instead of floating with an odd
          margin above it. */}
      {!collapsed && <div className="panel-label px-2.5 pb-1.5">Workspace</div>}
      {collapsed && <div className="mx-2 mb-1 border-t border-border-subtle/60" />}
      <nav className="flex flex-col gap-0.5">
        {workspaceTools.map((tool) => (
          <NavItem
            key={tool.href}
            href={tool.href}
            label={tool.label}
            description={TOOLTIP_BLURBS[tool.href] ?? tool.label}
            icon={TOOL_ICONS[tool.icon] ?? LayoutGrid}
            collapsed={collapsed}
            active={!!pathname?.startsWith(tool.href)}
            {...dragHandlers(tool.href)}
          />
        ))}
        <Tooltip label={collapsed ? "Community" : TOOLTIP_BLURBS["/explore"]}>
          <Link
            href="/explore"
            className={cn(
              "group flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors active:scale-[0.97]",
              collapsed ? "justify-center p-2" : "px-2.5 py-1.5",
              pathname?.startsWith("/explore")
                ? "bg-accent/10 text-foreground"
                : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            )}
          >
            <Globe
              className={cn(
                "h-[15px] w-[15px] shrink-0 transition-transform duration-150 group-hover:scale-110",
                pathname?.startsWith("/explore") && "text-accent"
              )}
            />
            {!collapsed && <span className="truncate">Community</span>}
          </Link>
        </Tooltip>
      </nav>

      <div className="mt-4 flex flex-col gap-0.5">
        {!collapsed && <div className="panel-label px-2.5 pb-1.5">Tools</div>}
        {collapsed && <div className="mx-2 mb-1 border-t border-border-subtle/60" />}
        <div className="relative" ref={toolsRef}>
          <Tooltip label={collapsed ? "All tools" : "Browse every tool"}>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors",
                collapsed ? "justify-center p-2" : "px-2.5 py-1.5",
                drawerOpen ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              )}
            >
              <Grid3x3 className="h-[15px] w-[15px] shrink-0 transition-transform duration-150 group-hover:scale-110" />
              {!collapsed && <span className="truncate">All tools</span>}
            </button>
          </Tooltip>
          {drawerOpen && <ToolDrawer anchorRef={toolsRef} onClose={() => setDrawerOpen(false)} />}
        </div>
        {studioTools.map((tool) => (
          <NavItem
            key={tool.href}
            href={tool.href}
            label={tool.label}
            description={TOOLTIP_BLURBS[tool.href] ?? tool.label}
            icon={TOOL_ICONS[tool.icon] ?? LayoutGrid}
            collapsed={collapsed}
            active={!!pathname?.startsWith(tool.href)}
            {...dragHandlers(tool.href)}
          />
        ))}

        {/* Gallery/Projects/Templates/Library/Resources (+ Spaces, admin-only
            for now) — a second group nested under "Tools", separated with
            just a plain divider rather than a heavier indent treatment. */}
        {(contentTools.length > 0 || isAdmin) && <div className="mx-2 my-1 border-t border-border-subtle/60" />}
        {contentTools.map((tool) => (
          <NavItem
            key={tool.href}
            href={tool.href}
            label={tool.label}
            description={TOOLTIP_BLURBS[tool.href] ?? tool.label}
            icon={TOOL_ICONS[tool.icon] ?? LayoutGrid}
            collapsed={collapsed}
            active={!!pathname?.startsWith(tool.href)}
            {...dragHandlers(tool.href)}
          />
        ))}
        {/* Spaces (+ its Flows tab) is admin-only for now — hidden from
            general users while it's still in development. */}
        {isAdmin && (
          <Tooltip label={collapsed ? "Spaces" : TOOLTIP_BLURBS["/spaces"]}>
            <Link
              href="/spaces"
              className={cn(
                "group flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors active:scale-[0.97]",
                collapsed ? "justify-center p-2" : "px-2.5 py-1.5",
                pathname?.startsWith("/spaces") || pathname?.startsWith("/flows")
                  ? "bg-accent/10 text-foreground"
                  : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              )}
            >
              <Workflow
                className={cn(
                  "h-[15px] w-[15px] shrink-0 transition-transform duration-150 group-hover:scale-110",
                  (pathname?.startsWith("/spaces") || pathname?.startsWith("/flows")) && "text-accent"
                )}
              />
              {!collapsed && <span className="truncate">Spaces</span>}
            </Link>
          </Tooltip>
        )}
      </div>
        </div>
        {canScrollUp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-surface via-surface/90 to-transparent pb-3 pt-1">
            <button
              onClick={() => scrollNavBy(-1)}
              title="Scroll up"
              className="pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-md hover:text-foreground"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          </div>
        )}
        {canScrollDown && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent pb-1 pt-3">
            <button
              onClick={() => scrollNavBy(1)}
              title="Scroll down"
              className="pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-muted shadow-md hover:text-foreground"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Footer: icon-only notifications + release notes + request + report
          bug (labels on hover). Usage/Admin moved to the top-right icon
          cluster next to the theme switch/account menu — see AccountBar.tsx.
          Grouped in its own subtle pill (rather than loose icons sitting
          directly on the sidebar background) so it reads as one deliberate
          utility cluster. */}
      <div
        className={cn(
          "flex shrink-0 gap-2.5 rounded-xl border border-border-subtle/60 bg-surface-2/40 p-2",
          collapsed ? "flex-col items-center" : "flex-row items-center justify-center"
        )}
      >
        <NotificationCenter />
        <Link
          href="/release-notes"
          title="Release notes"
          className={cn(
            "icon-btn-round",
            pathname?.startsWith("/release-notes") && "!bg-accent/10 !border-accent/30 !text-accent"
          )}
        >
          <Rocket className="h-3.5 w-3.5" />
        </Link>
        <FeedbackButtons collapsed={collapsed} />
      </div>
    </aside>
  );
}
