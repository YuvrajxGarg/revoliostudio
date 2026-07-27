"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_STUDIOS } from "@/lib/toolStudios";

/** The set of gallery filters the bar controls. All optional / falsy = off. */
export interface GalleryFilterState {
  createdAfter?: string;
  createdBefore?: string;
  toolId?: string | null; // undefined = any, null = plain generator, string = a tool
  favoritesOnly?: boolean;
  aspectRatio?: string;
}

const ASPECT_RATIOS = ["1:1", "4:3", "3:2", "16:9", "9:16", "3:4"];

/** Count of active filters, for the badge on the trigger. */
export function countActiveFilters(f: GalleryFilterState): number {
  let n = 0;
  if (f.createdAfter) n++;
  if (f.createdBefore) n++;
  if (f.toolId !== undefined) n++;
  if (f.favoritesOnly) n++;
  if (f.aspectRatio) n++;
  return n;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-accent/60 bg-accent/10 text-foreground"
          : "border-border-subtle bg-surface-2 text-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function GalleryFilters({
  value,
  onChange,
  showTool = true,
}: {
  value: GalleryFilterState;
  onChange: (next: GalleryFilterState) => void;
  /** Hidden in the tool/plain studios, which are already scoped to one tool. */
  showTool?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = countActiveFilters(value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const set = (patch: Partial<GalleryFilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
          active > 0
            ? "border-accent/60 bg-accent/10 text-foreground"
            : "border-border-subtle bg-surface text-muted hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {active > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {active}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border-subtle bg-surface p-4 shadow-2xl flex flex-col gap-4">
          <Section label="Date range">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={value.createdAfter?.slice(0, 10) ?? ""}
                onChange={(e) => set({ createdAfter: e.target.value ? `${e.target.value}T00:00:00` : undefined })}
                className="flex-1 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
              <span className="text-muted">→</span>
              <input
                type="date"
                value={value.createdBefore?.slice(0, 10) ?? ""}
                onChange={(e) => set({ createdBefore: e.target.value ? `${e.target.value}T23:59:59` : undefined })}
                className="flex-1 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </div>
          </Section>

          {showTool && (
            <Section label="Tool">
              <div className="flex flex-wrap gap-1.5">
                <Chip active={value.toolId === null} onClick={() => set({ toolId: value.toolId === null ? undefined : null })}>
                  Generator
                </Chip>
                {TOOL_STUDIOS.map((t) => (
                  <Chip
                    key={t.id}
                    active={value.toolId === t.id}
                    onClick={() => set({ toolId: value.toolId === t.id ? undefined : t.id })}
                  >
                    {t.title.replace(/ Studio| Generator| Photography/, "")}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          <Section label="Properties">
            <Chip active={!!value.favoritesOnly} onClick={() => set({ favoritesOnly: !value.favoritesOnly })}>
              <Star className={cn("h-3 w-3", value.favoritesOnly && "fill-current")} /> Favorited
            </Chip>
          </Section>

          <Section label="Aspect ratio">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!value.aspectRatio} onClick={() => set({ aspectRatio: undefined })}>
                Any
              </Chip>
              {ASPECT_RATIOS.map((ar) => (
                <Chip
                  key={ar}
                  active={value.aspectRatio === ar}
                  onClick={() => set({ aspectRatio: value.aspectRatio === ar ? undefined : ar })}
                >
                  {ar}
                </Chip>
              ))}
            </div>
          </Section>

          {active > 0 && (
            <button
              onClick={() => onChange({})}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-border-subtle"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
