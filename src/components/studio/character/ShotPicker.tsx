"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCostUSD, formatCostINR } from "@/lib/pricing";
import { SECTION_ORDER, SECTION_LABELS, SLOT_CATALOG } from "@/lib/characterSheetSlots";

/**
 * "Empty style sheet" shot picker — the same section/shot structure the
 * final poster uses. Each option is a real reference card image
 * (public/character-sheet-icons/<slot-id>.png — one consistent ivory clay/
 * marble bust character, generated once via gpt_image_2 chained off a
 * single anchor photo so every card shows the same "person") shown full-bleed
 * with a caption overlay, rather than a plain text chip, so the picker reads
 * as a visual sheet you're building rather than a settings list. Filenames
 * match SLOT_CATALOG's ids 1:1.
 */
export function ShotPicker({
  selectedIds,
  onToggle,
  costPerImageUsd,
  disabled,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  costPerImageUsd: number;
  disabled?: boolean;
}) {
  const totalCost = selectedIds.size * costPerImageUsd;

  function toggleSection(section: (typeof SECTION_ORDER)[number], allSelected: boolean) {
    const ids = SLOT_CATALOG.filter((s) => s.section === section).map((s) => s.id);
    for (const id of ids) {
      const isSelected = selectedIds.has(id);
      if (allSelected && isSelected) onToggle(id);
      if (!allSelected && !isSelected) onToggle(id);
    }
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Customize your sheet</div>
          <p className="mt-0.5 text-xs text-muted">Pick exactly which shots to generate.</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div className="font-medium text-foreground">{selectedIds.size} shots</div>
          <div>
            {formatCostUSD(totalCost)} · {formatCostINR(totalCost)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {SECTION_ORDER.map((section) => {
          const shots = SLOT_CATALOG.filter((s) => s.section === section);
          const allSelected = shots.every((s) => selectedIds.has(s.id));
          return (
            <div key={section}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {SECTION_LABELS[section]}
                </span>
                <button
                  onClick={() => toggleSection(section, allSelected)}
                  disabled={disabled}
                  className="text-[10px] text-accent hover:underline disabled:opacity-50"
                >
                  {allSelected ? "Clear" : "All"}
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {shots.map((shot) => {
                  const selected = selectedIds.has(shot.id);
                  return (
                    <button
                      key={shot.id}
                      onClick={() => onToggle(shot.id)}
                      disabled={disabled}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-2xl border-2 bg-surface-2 transition-all disabled:opacity-50",
                        selected
                          ? "border-accent shadow-[0_0_0_3px_var(--accent)_inset]"
                          : "border-border-subtle hover:border-accent/50"
                      )}
                    >
                      <Image
                        src={`/character-sheet-icons/${shot.id}.png`}
                        alt={shot.label}
                        fill
                        sizes="(min-width: 1024px) 220px, (min-width: 640px) 180px, 33vw"
                        className={cn(
                          "object-cover transition-transform duration-200 group-hover:scale-105",
                          !selected && "opacity-80 group-hover:opacity-100"
                        )}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-2.5 pb-2 pt-8">
                        <span className="block truncate text-xs font-semibold text-white">{shot.label}</span>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow-lg">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
