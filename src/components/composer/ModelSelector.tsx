"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Check, Search, Star } from "lucide-react";
import { ModelConfig } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useFavoriteModels } from "@/hooks/useFavoriteModels";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";

// Real provider logos via favicon lookup (with a letter-avatar fallback
// when a favicon can't be resolved) — mirrors the reference UI's icons.
const PROVIDER_DOMAINS: Record<string, string> = {
  Alibaba: "alibaba.com",
  "Black Forest Labs": "bfl.ai",
  ByteDance: "bytedance.com",
  Google: "google.com",
  HiDream: "hidream.ai",
  Ideogram: "ideogram.ai",
  Kuaishou: "klingai.com",
  Leonardo: "leonardo.ai",
  Lightricks: "lightricks.com",
  Meshy: "meshy.ai",
  Midjourney: "midjourney.com",
  MiniMax: "minimax.io",
  OpenAI: "openai.com",
  Photoroom: "photoroom.com",
  Pixverse: "pixverse.ai",
  Reve: "reve.com",
  Runway: "runwayml.com",
  Tencent: "tencent.com",
  Tongyi: "aliyun.com",
  Topaz: "topazlabs.com",
  Vidu: "vidu.com",
  muapi: "muapi.ai",
  xAI: "x.ai",
};

const PROVIDER_COLORS: Record<string, string> = {
  Google: "#4285f4",
  OpenAI: "#10a37f",
  Runway: "#6e6e6e",
  Kuaishou: "#ff6b00",
  Meshy: "#7c5cff",
  "Black Forest Labs": "#8b8b8b",
  Vidu: "#ff5cd0",
  Lightricks: "#c6ff5e",
  Pixverse: "#5ec6ff",
  MiniMax: "#f5a623",
  Midjourney: "#9b9b9b",
};

function ProviderAvatar({ provider, size = 16 }: { provider: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = PROVIDER_DOMAINS[provider];
  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-[4px]"
      />
    );
  }
  const color = PROVIDER_COLORS[provider] || "#e85002";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {provider.charAt(0).toUpperCase()}
    </span>
  );
}

function FavoriteStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className="shrink-0 rounded-md p-1 mt-0.5 hover:bg-border-subtle transition-colors"
    >
      <Star className={cn("h-3.5 w-3.5", active ? "fill-accent text-accent" : "text-muted")} />
    </button>
  );
}

const MODE_LABELS: Record<string, string> = {
  t2i: "Generate",
  i2i: "Edit / Reference",
  t2v: "Text to Video",
  i2v: "Image to Video",
  flf: "Start + End Frame",
  omni: "Multi-Reference",
  t23d: "Text to 3D",
  i23d: "Image to 3D",
  enhance: "Enhance",
};

function ModelRow({
  m,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  m: ModelConfig;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const usd = estimateCostUSD(m, {});
  // A <div role="button">, not a nested <button> — this row contains its own
  // real <button> (FavoriteStar's star toggle), and <button> inside <button>
  // is invalid HTML that React 19 flags as a hydration error. The role/
  // tabIndex/onKeyDown trio below keeps it just as keyboard-accessible as a
  // native button (Enter/Space activates it, Tab reaches it, screen readers
  // announce it as a button).
  return (
    <div
      role="button"
      tabIndex={m.unavailable ? -1 : 0}
      aria-disabled={m.unavailable || undefined}
      onClick={m.unavailable ? undefined : onSelect}
      onKeyDown={(e) => {
        if (m.unavailable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      title={m.unavailable ? m.unavailableReason : m.tagline}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer",
        m.unavailable ? "cursor-not-allowed opacity-40" : "hover:bg-surface-2",
        isSelected && !m.unavailable && "bg-surface-2"
      )}
    >
      <span className="mt-0.5">
        <ProviderAvatar provider={m.provider} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{m.label}</span>
          {m.unavailable ? (
            <span className="rounded-full bg-danger/15 text-danger-text px-1.5 py-0.5 text-[10px] font-semibold">
              Down
            </span>
          ) : (
            m.badge && (
              <span className="rounded-full bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-semibold">
                {m.badge}
              </span>
            )
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 flex-wrap">
          {m.maxReferences > 0 && (
            <span className="rounded bg-surface-2 border border-border-subtle px-1 py-px text-[9px] uppercase tracking-wide text-muted">
              Refs
            </span>
          )}
          <span className="rounded bg-surface-2 border border-border-subtle px-1 py-px text-[9px] uppercase tracking-wide text-muted">
            {MODE_LABELS[m.mode] ?? m.mode}
          </span>
          <span className="text-[10px] text-foreground/70">
            {formatCostUSD(usd)} · {formatCostINR(usd)}
          </span>
        </div>
      </div>
      {!m.unavailable && <FavoriteStar active={isFavorite} onToggle={onToggleFavorite} />}
      {isSelected && !m.unavailable && <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
    </div>
  );
}

/**
 * Magnific-style model picker. The trigger lives in the panel, but the
 * picker itself opens as a large fixed overlay next to it (portaled to
 * <body>) so it's never clipped by the sidebar — search on top, Featured
 * section, then all models grouped by provider with real logos and counts.
 */
export function ModelSelector({
  models,
  selectedId,
  onSelect,
  direction = "up",
}: {
  models: ModelConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** "down" = studio side panel (overlay opens to the right); "up" = bottom composer (overlay opens above). */
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    left: 0,
    width: 560,
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = models.find((m) => m.id === selectedId) ?? models[0];
  const { favorites, toggleFavorite } = useFavoriteModels();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(560, vw - 24);
      if (direction === "down") {
        // Open beside the panel, top-aligned with the trigger — was
        // previously always pinned to the bottom of the viewport, which
        // left a large disconnected gap whenever the trigger sat near the
        // top of a tall sidebar (e.g. Edit Video's Model picker). Anchoring
        // to the trigger's own top, clamped so the panel never overflows
        // past the bottom edge, keeps it visually attached everywhere this
        // is used.
        const left = Math.max(12, Math.min(rect.right + 12, vw - width - 12));
        const maxPanelHeight = Math.min(560, vh - 24);
        const top = Math.max(12, Math.min(rect.top, vh - maxPanelHeight - 12));
        setPos({ top, left, width });
      } else {
        const left = Math.max(12, Math.min(rect.left, vw - width - 12));
        setPos({ bottom: vh - rect.top + 8, left, width });
      }
    }
    setQuery("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.mode.toLowerCase().includes(q)
    );
  }, [models, query]);

  const searching = query.trim().length > 0;

  const featured = useMemo(
    () => filtered.filter((m) => favorites.has(m.id) || m.recommended),
    [filtered, favorites]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ModelConfig[]>();
    for (const m of filtered) {
      const arr = map.get(m.provider) ?? [];
      arr.push(m);
      map.set(m.provider, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function toggleGroup(provider: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  }

  function pick(id: string) {
    onSelect(id);
    setOpen(false);
  }

  const isPanel = direction === "down";

  return (
    <div className="relative" ref={triggerRef}>
      {isPanel ? (
        <button
          onClick={() => (open ? setOpen(false) : openPanel())}
          className="flex w-full items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-2.5 py-2 text-left hover:border-accent/50 transition-colors"
        >
          {selected && <ProviderAvatar provider={selected.provider} />}
          <span className="flex-1 truncate text-sm font-medium">{selected?.label ?? "Select model"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
        </button>
      ) : (
        <button
          onClick={() => (open ? setOpen(false) : openPanel())}
          className="control-pill py-1.5 hover:!bg-border-subtle"
        >
          {selected && <ProviderAvatar provider={selected.provider} />}
          <span className="max-w-[10rem] truncate font-medium">{selected?.label ?? "Select model"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
        </button>
      )}

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
              width: pos.width,
              maxHeight:
                pos.top !== undefined
                  ? `calc(100vh - ${pos.top}px - 16px)`
                  : `calc(100vh - ${pos.bottom ?? 0}px - 16px)`,
            }}
            className="z-[70] flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
          >
            <div className="p-2.5 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <Search className="h-4 w-4 text-muted shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-2 py-8 text-center text-xs text-muted">
                  No models match &ldquo;{query}&rdquo;
                </div>
              )}

              {!searching && featured.length > 0 && (
                <div className="mb-1">
                  <div className="panel-label px-2.5 py-1.5">Featured</div>
                  {featured.map((m) => (
                    <ModelRow
                      key={`featured-${m.id}`}
                      m={m}
                      isSelected={m.id === selected?.id}
                      isFavorite={favorites.has(m.id)}
                      onSelect={() => pick(m.id)}
                      onToggleFavorite={() => toggleFavorite(m.id)}
                    />
                  ))}
                </div>
              )}

              {searching ? (
                filtered.map((m) => (
                  <ModelRow
                    key={`search-${m.id}`}
                    m={m}
                    isSelected={m.id === selected?.id}
                    isFavorite={favorites.has(m.id)}
                    onSelect={() => pick(m.id)}
                    onToggleFavorite={() => toggleFavorite(m.id)}
                  />
                ))
              ) : (
                <>
                  <div className="panel-label px-2.5 py-1.5">All models</div>
                  {grouped.map(([provider, group]) => {
                    const isOpen = expanded.has(provider);
                    return (
                      <div key={provider}>
                        <button
                          onClick={() => toggleGroup(provider)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 transition-colors"
                        >
                          <ProviderAvatar provider={provider} />
                          <span className="flex-1 truncate text-sm">{provider}</span>
                          <span className="text-[11px] text-muted">
                            {group.length} model{group.length === 1 ? "" : "s"}
                          </span>
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="ml-3 border-l border-border-subtle pl-1.5">
                            {group.map((m) => (
                              <ModelRow
                                key={m.id}
                                m={m}
                                isSelected={m.id === selected?.id}
                                isFavorite={favorites.has(m.id)}
                                onSelect={() => pick(m.id)}
                                onToggleFavorite={() => toggleFavorite(m.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
