"use client";

import { Search, X } from "lucide-react";
import { GalleryFilters, type GalleryFilterState } from "./GalleryFilters";

/**
 * Shared search box + filter popover used across every gallery surface (the
 * main Gallery, each studio's Creations tab, tool studios). Controlled — the
 * host owns `search` / `filters` state and passes them into its
 * useGenerations call. In the tool/plain studios pass showTool={false} since
 * those are already scoped to one tool.
 */
export function GalleryToolbar({
  search,
  onSearch,
  filters,
  onFilters,
  showTool = true,
}: {
  search: string;
  onSearch: (v: string) => void;
  filters: GalleryFilterState;
  onFilters: (f: GalleryFilterState) => void;
  showTool?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 focus-within:border-accent transition-colors">
        <Search className="h-3.5 w-3.5 text-muted shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className="w-28 sm:w-40 bg-transparent text-xs outline-none placeholder:text-muted"
        />
        {search && (
          <button onClick={() => onSearch("")} className="text-muted hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <GalleryFilters value={filters} onChange={onFilters} showTool={showTool} />
    </div>
  );
}
