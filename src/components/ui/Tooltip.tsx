"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const SHOW_DELAY_MS = 300;

/**
 * Small on-brand hover label — a styled replacement for the native browser
 * `title` tooltip (unstyled, and its show-delay is entirely OS-controlled).
 *
 * Portaled to document.body + positioned from the trigger's own
 * getBoundingClientRect(), rather than a plain CSS `group-hover` sibling —
 * the sidebar's nav list wraps every tooltip-triggering item in a scrollable
 * `overflow-y-auto` container (AppSidebar.tsx, added for the scroll-arrow
 * behavior once enough tools are pinned), and per the CSS spec, setting only
 * `overflow-y` forces `overflow-x` to also compute to `auto` instead of
 * `visible` — so a same-DOM-tree tooltip popping out to the right (or above,
 * near the top of a scrolled list) was silently clipped by that ancestor.
 * Same reasoning every other overlay in this codebase (AutopilotReferencePicker,
 * LlmModelSelector, ReferencePicker, ...) already portals for.
 */
export function Tooltip({
  label,
  children,
  side = "right",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "right" | "top";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function computePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (side === "right") {
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    } else {
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
  }

  function clearShowTimer() {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }

  function handleMouseEnter() {
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      computePosition();
      setOpen(true);
    }, SHOW_DELAY_MS);
  }

  function handleHide() {
    clearShowTimer();
    setOpen(false);
  }

  // Keyboard focus (tabbing through the sidebar) shows it instantly — the
  // delay above is specifically to avoid flashing on a quick mouse pass,
  // which doesn't apply to an intentional Tab press.
  function handleFocus() {
    clearShowTimer();
    computePosition();
    setOpen(true);
  }

  useEffect(() => clearShowTimer, []);

  return (
    <div
      ref={triggerRef}
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleHide}
      onFocus={handleFocus}
      onBlur={handleHide}
    >
      {children}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: side === "right" ? "translateY(-50%)" : "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-[80]"
          >
            <span
              role="tooltip"
              className="animate-menu-pop-in block whitespace-nowrap rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xl"
            >
              {label}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
