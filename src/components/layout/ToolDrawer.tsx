"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LayoutGrid, Pin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_TOOLS, type ToolCategory } from "@/lib/tools";
import { TOOL_ICON_MAP as ICONS } from "@/lib/toolIcons";
import { useToolPinsStore } from "@/store/toolPinsStore";

const TABS: { id: "All" | ToolCategory; label: string }[] = [
  { id: "All", label: "All" },
  { id: "Image", label: "Image" },
  { id: "Video", label: "Video" },
  { id: "Audio", label: "Audio" },
  { id: "3D", label: "3D" },
  { id: "Design", label: "Design" },
  { id: "Flows", label: "Flows" },
  { id: "Workspace", label: "Workspace" },
];

/**
 * Magnific-style "All tools" flyout, anchored under the "All tools" sidebar
 * item. Portaled to <body> with fixed positioning computed from the
 * trigger's own bounding rect (same pattern as ModelSelector) — the sidebar
 * and the studio panels each create their own stacking context (backdrop
 * blur, etc.), so a plain `position: absolute` child gets painted behind
 * later DOM siblings regardless of z-index. Portaling sidesteps that
 * entirely and guarantees this always renders on top.
 */
export function ToolDrawer({
  anchorRef,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const { pinnedHrefs, togglePin } = useToolPinsStore();
  const [tab, setTab] = useState<"All" | ToolCategory>("All");
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(680, vw - 24);
    const left = Math.max(12, Math.min(rect.right + 8, vw - width - 12));
    const top = Math.max(12, Math.min(rect.top, vh - 24));
    setPos({ top, left, width });
  }, [anchorRef]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [anchorRef, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_TOOLS.filter((t) => {
      if (tab !== "All" && t.category !== tab) return false;
      if (!q) return true;
      return t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [tab, query]);

  if (!pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: `calc(100vh - ${pos.top}px - 16px)`,
      }}
      className="animate-menu-pop-in z-[70] flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
    >
      <div className="flex flex-col gap-2 border-b border-border-subtle px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold shrink-0">All tools</span>
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="w-32 bg-transparent text-xs outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-2 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                tab === t.id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="px-1 pb-2 text-[11px] text-muted">Pin the ones you use most — they'll show up in the sidebar.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((tool, i) => {
            const Icon = ICONS[tool.icon] ?? LayoutGrid;
            const pinned = pinnedHrefs.includes(tool.href);
            return (
              <div
                key={tool.href}
                className="timeline-item group relative flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-2/60 p-2 hover:border-accent/50 hover:bg-surface-2 transition-colors"
                style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }}
              >
                <Link
                  href={tool.href}
                  onClick={onClose}
                  className="flex min-w-0 flex-1 items-center gap-2.5 transition-transform active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground transition-colors group-hover:bg-accent/10 group-hover:text-accent">
                    <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{tool.label}</span>
                    <span className="block truncate text-[11px] text-muted">{tool.description}</span>
                  </span>
                </Link>
                <button
                  onClick={() => togglePin(tool.href)}
                  title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                    pinned
                      ? "text-accent opacity-100"
                      : "text-muted opacity-0 group-hover:opacity-100 hover:bg-surface"
                  )}
                >
                  <Pin className={cn("h-3.5 w-3.5", pinned && "fill-current")} />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 py-8 text-center text-xs text-muted">No tools match "{query}".</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
