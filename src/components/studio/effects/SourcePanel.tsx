"use client";

import { useRef } from "react";
import {
  Ban,
  Blend,
  Grid3x3,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Square,
  Terminal,
  Upload,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EFFECTS, EFFECT_CATEGORIES, EFFECT_CATEGORY_LABELS } from "@/lib/effects/registry";
import type { EffectCategory } from "@/lib/effects/types";

/** No live-animated per-card thumbnails (Ladybug's own effect cards render a
 * tiny live preview) — v1 uses one static icon per category instead, a
 * deliberate simplification flagged in the Effects Studio plan. */
const CATEGORY_ICON: Record<EffectCategory, LucideIcon> = {
  edges: ScanLine,
  pixel: Grid3x3,
  halftone: Square,
  color: Blend,
  type: Terminal,
  glitch: Waves,
};

export function SourcePanel({
  sourceName,
  onUpload,
  activeCategory,
  onCategoryChange,
  selectedEffectId,
  onSelectEffect,
}: {
  sourceName: string | null;
  onUpload: (file: File) => void;
  activeCategory: EffectCategory | "all";
  onCategoryChange: (c: EffectCategory | "all") => void;
  selectedEffectId: string | null;
  onSelectEffect: (id: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleEffects = activeCategory === "all" ? EFFECTS : EFFECTS.filter((e) => e.category === activeCategory);

  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border-subtle bg-surface p-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-2/60 p-2.5">
        <div className="min-w-0">
          <div className="panel-label">Source</div>
          <div className="truncate text-xs font-medium">{sourceName ?? "No file yet"}</div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-medium hover:bg-border-subtle transition-colors"
        >
          <Upload className="h-3 w-3" /> {sourceName ? "Replace" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => onCategoryChange("all")}
          className={cn(
            "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
            activeCategory === "all" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          All
        </button>
        {EFFECT_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => onCategoryChange(c)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
              activeCategory === c ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {EFFECT_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 content-start">
        <button
          onClick={() => onSelectEffect(null)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
            selectedEffectId === null ? "border-accent bg-accent/10" : "border-border-subtle bg-surface-2/40 hover:border-accent/40"
          )}
        >
          <Ban className="h-4 w-4 text-muted" />
          <span className="text-[11px] font-medium">No effect</span>
        </button>
        {visibleEffects.map((effect) => {
          const Icon = CATEGORY_ICON[effect.category] ?? Sparkles;
          const selected = selectedEffectId === effect.id;
          return (
            <button
              key={effect.id}
              onClick={() => onSelectEffect(effect.id)}
              title={effect.description}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                selected ? "border-accent bg-accent/10" : "border-border-subtle bg-surface-2/40 hover:border-accent/40"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  selected ? "bg-accent/20 text-accent" : "bg-surface text-muted"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium leading-tight">{effect.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border-subtle pt-2 text-[10px] text-muted">
        <SlidersHorizontal className="h-3 w-3" /> {EFFECTS.length} effects
      </div>
    </div>
  );
}
