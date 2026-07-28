"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHARACTER_MODEL_OPTIONS, getCharacterModelOption } from "@/lib/characterSheetModels";

/**
 * Compact dropdown for the 5 curated face-consistency models — same
 * portaled-popover pattern as LlmModelSelector/AutopilotReferencePicker
 * (positioned from the trigger's own getBoundingClientRect, closes on
 * click-away), just without a search box since there are only 5 options,
 * not 25.
 */
export function CharacterModelSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = getCharacterModelOption(value);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleOpen() {
    if (disabled) return;
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const vw = window.innerWidth;
        const width = Math.min(300, vw - 24);
        setPos({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, vw - width - 12)), width });
      }
    }
    setOpen((v) => !v);
  }

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Model — best for facial consistency
      </div>
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-2/40 px-3 py-2.5 text-left transition-colors disabled:opacity-50",
          open && "border-accent/50"
        )}
      >
        <div className="min-w-0">
          <div className="text-xs font-medium">{selected.label}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted">{selected.blurb}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs font-medium text-accent">${selected.costPerImageUsd.toFixed(2)}/shot</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[70] flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-2xl"
          >
            {CHARACTER_MODEL_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2",
                  m.id === selected.id && "bg-surface-2"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {m.label}
                    {m.id === selected.id && <Check className="h-3 w-3 text-accent" />}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted leading-relaxed">{m.blurb}</div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-accent">${m.costPerImageUsd.toFixed(2)}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
