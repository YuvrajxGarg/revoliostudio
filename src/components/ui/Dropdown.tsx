"use client";

import { useEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("control-pill", fullWidth && "w-full !rounded-lg justify-between bg-surface-2")}
      >
        {selected?.icon ?? icon}
        <span className="truncate">{label ?? selected?.label ?? value}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "animate-menu-pop-in absolute min-w-[9rem] rounded-xl border border-border-subtle bg-surface shadow-2xl z-50 p-1.5",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
            fullWidth ? "left-0 right-0" : align === "right" ? "right-0" : "left-0"
          )}
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
        </div>
      )}
    </div>
  );
}
