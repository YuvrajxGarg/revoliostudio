"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOT_CATALOG, SECTION_LABELS } from "@/lib/characterSheetSlots";

const PAGE_SIZE = 6;
const PAGES = Array.from({ length: Math.ceil(SLOT_CATALOG.length / PAGE_SIZE) }, (_, i) =>
  SLOT_CATALOG.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE)
);

export function HowItWorksTab() {
  const [page, setPage] = useState(0);
  const items = PAGES[page];

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 flex flex-col gap-8 text-center">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight uppercase">
          What you get from one upload
        </h1>
        <p className="mt-2 text-sm text-muted max-w-lg mx-auto">
          A complete consistency kit: angles, poses, details, expressions and lighting — pick
          exactly which ones your character needs on the Generate tab.
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div
              key={`${page}-${i}`}
              className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface-2/40 p-6"
            >
              <UserRound className="h-10 w-10 text-muted" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="icon-btn-round disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn("h-1.5 w-1.5 rounded-full transition-colors", i === page ? "bg-accent" : "bg-border-subtle")}
              />
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(PAGES.length - 1, p + 1))}
            disabled={page === PAGES.length - 1}
            className="icon-btn-round disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-left">
        {(Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((s) => (
          <div key={s} className="rounded-xl border border-border-subtle bg-surface p-3">
            <div className="text-xs font-semibold">{SECTION_LABELS[s]}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {SLOT_CATALOG.filter((l) => l.section === s).length} shots
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
