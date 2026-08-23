"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional per-option glyph (e.g. an aspect-ratio shape) shown before the
   * label in the open panel, and in the trigger button when this option is
   * the current selection. */
  icon?: React.ReactNode;
}

/**
 * A small custom dropdown — replaces native <select> elements with a
 * properly styled floating panel + checkmarks (native selects render as the
 * OS's default menu, which looks out of place next to the rest of the UI).
 */
export function Dropdown({
  value,
  options,
  onChange,
  icon,
  label,
  panelTitle,
  align = "left",
  fullWidth = false,
  direction = "down",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  /** Optional fixed label instead of the selected option's label (e.g. an aspect-ratio glyph). */
  label?: string;
  panelTitle?: string;
  align?: "left" | "right";
  /** Stretch the trigger to fill its container — used for form-style dropdowns (e.g. the 3D options panel). */
  fullWidth?: boolean;
  /** Which way the panel opens. "up" avoids clipping when the dropdown sits in a bar docked near the bottom of the viewport (e.g. the Image composer's settings row). */
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  // Panel position in viewport coordinates — the open panel is portaled to
  // <body> with position:fixed (same approach as ModelSelector) instead of
  // being an absolutely-positioned child. As a plain child it was clipped by
  // any scrolling/overflow-hidden ancestor — most visibly the mobile
  // tool-studio composer bar (max-h + overflow-y-auto), where opening the
  // quality selector near the Generate button cut the menu off entirely.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number; width?: number }>({});
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // The fixed-position panel doesn't move with its trigger — close it on any
  // scroll/resize rather than chasing the trigger around.
  useEffect(() => {
    if (!open) return;
    // Capture-phase so scrolls inside nested scroll containers (sidebar
    // panel, mobile composer bar) are seen too — but a scroll of the open
    // panel's own option list must NOT close it.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function openPanel() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceAbove = rect.top;
      const spaceBelow = vh - rect.bottom;
      // Flip to the roomier side when the preferred one can't fit a typical
      // menu — a "down" menu opened near the bottom of a short window (or an
      // "up" one right under a top bar) would otherwise run off-viewport.
      let dir = direction;
      if (direction === "down" && spaceBelow < 280 && spaceAbove > spaceBelow) dir = "up";
      if (direction === "up" && spaceAbove < 280 && spaceBelow > spaceAbove) dir = "down";
      const next: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        width?: number;
        maxHeight?: number;
      } = {};
      if (dir === "up") next.bottom = vh - rect.top + 8;
      else next.top = rect.bottom + 8;
      next.maxHeight = Math.min(420, Math.max(160, (dir === "up" ? spaceAbove : spaceBelow) - 20));
      if (fullWidth) {
        next.left = rect.left;
        next.width = rect.width;
      } else if (align === "right") {
        next.right = Math.max(12, vw - rect.right);
      } else {
        // Clamp so a menu opened near the right edge of a small screen
        // never runs off-viewport (9rem min width = 144px).
        next.left = Math.max(12, Math.min(rect.left, vw - 156));
      }
      setPos(next);
    }
    setOpen(true);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={cn("control-pill", fullWidth && "w-full !rounded-lg justify-between bg-surface-2")}
      >
        {selected?.icon ?? icon}
        <span className="truncate">{label ?? selected?.label ?? value}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              right: pos.right,
              width: pos.width,
              maxHeight: "min(60vh, 420px)",
            }}
            // z-[130]: portaled to <body>, so this must out-stack whatever
            // container the trigger lives in — dropdowns open from inside
            // dialogs (z-[110]) and above Compare/Confirm (z-[120]), while
            // staying under ImageLightbox (z-[140]) and ContextMenu (z-[150]).
            className="animate-menu-pop-in z-[130] min-w-[9rem] overflow-y-auto rounded-xl border border-border-subtle bg-surface shadow-2xl p-1.5"
          >
          {panelTitle && (
            <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {panelTitle}
            </div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2",
                o.value === value && "text-accent"
              )}
            >
              {o.icon && <span className="shrink-0 text-muted [&>svg]:block">{o.icon}</span>}
              <span className="flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          </div>,
          document.body
        )}
    </div>
  );
}
