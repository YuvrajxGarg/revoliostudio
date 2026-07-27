"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small on-brand hover label — a styled replacement for the native browser
 * `title` tooltip (unstyled, and its show-delay is entirely OS-controlled).
 * Pure CSS: `group-hover` + `transition-delay` on the shown state only, so
 * it appears after a brief pause (doesn't flash on every mouse pass over a
 * dense nav list) but disappears instantly on mouse-leave. No JS timers.
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
  return (
    <div className={cn("group/tooltip relative", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 origin-left scale-95 whitespace-nowrap rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150",
          "group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-hover/tooltip:delay-300",
          // Keyboard focus (tabbing through the sidebar) shows it too, no
          // delay — the delay is specifically to avoid flashing on a quick
          // mouse pass, which doesn't apply to an intentional Tab press.
          "group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100",
          side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
          side === "top" && "bottom-full left-1/2 mb-2 origin-bottom -translate-x-1/2"
        )}
      >
        {label}
      </span>
    </div>
  );
}
