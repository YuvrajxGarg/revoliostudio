"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { ALL_TOOLS, type ToolEntry } from "@/lib/tools";
import { resolveToolIcon } from "@/lib/toolIcons";
import { getRecentTools } from "@/lib/recentTools";
import { cn } from "@/lib/utils";

// Decorative only (not bound as real global shortcuts, to avoid hijacking
// browser combos app-wide) — just gives the most-reached-for actions a
// keycap badge like the reference.
const SHORTCUT_HINTS: Record<string, string> = {
  "/studio/image": "⌘⇧I",
  "/studio/video": "⌘⇧V",
  "/studio/audio": "⌘⇧A",
  "/gallery": "⌘⇧L",
};

type PaletteItem =
  | { kind: "search"; query: string }
  | { kind: "tool"; tool: ToolEntry; section: "recent" | "action" };

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  shortcut,
  active,
  onClick,
  onMouseEnter,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  shortcut?: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
        active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{label}</span>
        {description && <span className="ml-2 truncate text-xs text-muted">{description}</span>}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}

/**
 * Magnific-style "Search your work, or just ask" command palette — the
 * Home search bar itself doubles as the trigger, plus a global Ctrl/Cmd+K
 * shortcut. Self-contained: owns its own open/query/selection state so
 * HomeDashboard just drops this in where the old plain input used to be.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Where the panel grows down from — captured from the real search bar's
  // on-screen position each time it opens (falls back to a sane top-center
  // spot if the trigger somehow isn't measurable), so the palette always
  // appears to expand out of the bar itself instead of popping up centered
  // in the middle of the viewport.
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 640 });
  const [entered, setEntered] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Runs before paint so the panel never flashes at a stale/default
  // position — by the time this frame is on screen it's already anchored.
  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setQuery("");
    setActiveIndex(0);
    setRecentHrefs(getRecentTools());
    const rect = triggerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 640;
    setAnchor({
      top: rect?.top ?? Math.round(window.innerHeight * 0.12),
      left: rect?.left ?? Math.round(window.innerWidth / 2 - width / 2),
      width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Deferred one frame so the browser paints the collapsed (just-anchored)
    // state first — flipping `entered` here is what makes the panel's
    // transition classes actually animate instead of snapping straight in.
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const quickActions = useMemo(() => ALL_TOOLS.filter((t) => t.href !== "/home"), []);
  const recentTools = useMemo(
    () => recentHrefs.map((href) => ALL_TOOLS.find((t) => t.href === href)).filter((t): t is ToolEntry => !!t),
    [recentHrefs]
  );

  function matches(t: ToolEntry) {
    return t.label.toLowerCase().includes(normalizedQuery) || t.description.toLowerCase().includes(normalizedQuery);
  }

  const filteredRecents = normalizedQuery ? recentTools.filter(matches) : recentTools;
  const filteredActions = normalizedQuery ? quickActions.filter(matches) : quickActions;

  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];
    if (query.trim()) list.push({ kind: "search", query: query.trim() });
    list.push(...filteredRecents.map((tool) => ({ kind: "tool" as const, tool, section: "recent" as const })));
    list.push(...filteredActions.map((tool) => ({ kind: "tool" as const, tool, section: "action" as const })));
    return list;
  }, [query, filteredRecents, filteredActions]);

  // Each row's real index into `items` (the keyboard-nav order) — computed
  // once here so the three rendered sections below can each filter down to
  // their own rows while keeping the correct absolute index, even when the
  // same tool appears in both Recents and Quick actions as two distinct
  // rows.
  const indexed = useMemo(() => items.map((item, idx) => ({ item, idx })), [items]);
  const searchRow = indexed[0]?.item.kind === "search" ? indexed[0] : null;
  const recentRows = indexed.filter((r) => r.item.kind === "tool" && r.item.section === "recent");
  const actionRows = indexed.filter((r) => r.item.kind === "tool" && r.item.section === "action");

  function activate(item: PaletteItem, newTab: boolean) {
    const href = item.kind === "search" ? `/gallery?q=${encodeURIComponent(item.query)}` : item.tool.href;
    if (newTab) window.open(href, "_blank");
    else router.push(href);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) activate(item, e.shiftKey);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-left transition-colors hover:border-accent/40",
          open && "invisible"
        )}
      >
        <Search className="h-4 w-4 text-muted shrink-0" />
        <span className="flex-1 text-sm text-muted">Search your work, or just ask</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className={cn(
              "fixed inset-0 z-50 transition-[background-color,backdrop-filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              entered ? "bg-black/60 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
            )}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                position: "fixed",
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                maxHeight: `calc(100vh - ${anchor.top + 24}px)`,
                transformOrigin: "top center",
                transform: entered ? "translateY(0) scaleY(1)" : "translateY(-10px) scaleY(0.94)",
                opacity: entered ? 1 : 0,
              }}
              className="z-50 h-fit overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3.5">
                <Search className="h-4 w-4 text-muted shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search your work, or just ask"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                />
                <Kbd>Esc</Kbd>
              </div>

              <div className="max-h-[50vh] overflow-y-auto p-2">
                {items.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted">No matches for &quot;{query}&quot;.</div>
                )}

                {searchRow && searchRow.item.kind === "search" && (
                  <div className="mb-1">
                    <Row
                      icon={Search}
                      label={`Search generations for "${searchRow.item.query}"`}
                      active={activeIndex === searchRow.idx}
                      onClick={() => activate(searchRow.item, false)}
                      onMouseEnter={() => setActiveIndex(searchRow.idx)}
                    />
                  </div>
                )}

                {recentRows.length > 0 && (
                  <div className="mb-1">
                    <div className="panel-label px-2.5 pb-1 pt-1.5">Recents</div>
                    {recentRows.map(({ item, idx }) => {
                      if (item.kind !== "tool") return null;
                      return (
                        <Row
                          key={`recent-${item.tool.href}`}
                          icon={resolveToolIcon(item.tool.icon)}
                          label={item.tool.label}
                          active={activeIndex === idx}
                          onClick={() => activate(item, false)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </div>
                )}

                {actionRows.length > 0 && (
                  <div>
                    <div className="panel-label px-2.5 pb-1 pt-1.5">Quick actions</div>
                    {actionRows.map(({ item, idx }) => {
                      if (item.kind !== "tool") return null;
                      return (
                        <Row
                          key={`action-${item.tool.href}`}
                          icon={resolveToolIcon(item.tool.icon)}
                          label={item.tool.label}
                          description={item.tool.description}
                          shortcut={SHORTCUT_HINTS[item.tool.href]}
                          active={activeIndex === idx}
                          onClick={() => activate(item, false)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-2 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Kbd>↑↓</Kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>
                    <CornerDownLeft className="h-2.5 w-2.5" />
                  </Kbd>{" "}
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>Esc</Kbd> Close
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Kbd>⇧↵</Kbd> Open in new tab
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
