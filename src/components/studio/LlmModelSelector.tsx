"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import { LLM_MODELS, getLlmModel, formatLlmPricing, type LlmModelOption } from "@/lib/llmModels";
import { cn } from "@/lib/utils";

const PROVIDER_DOMAINS: Record<string, string> = {
  Anthropic: "anthropic.com",
  Google: "google.com",
  OpenAI: "openai.com",
  xAI: "x.ai",
};

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "#d97757",
  Google: "#4285f4",
  OpenAI: "#10a37f",
  xAI: "#000000",
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

function ModelRow({ m, isSelected, onSelect }: { m: LlmModelOption; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      title={m.description}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2",
        isSelected && "bg-surface-2"
      )}
    >
      <span className="mt-0.5">
        <ProviderAvatar provider={m.provider} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{m.label}</span>
        <p className="mt-0.5 text-[11px] text-muted leading-snug line-clamp-2">{m.description}</p>
        <span className="mt-1 inline-block text-[10px] text-foreground/70">{formatLlmPricing(m)}</span>
      </div>
      {isSelected && <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
    </button>
  );
}

/**
 * Pilot's LLM picker — same Magnific-style search + provider-grouped panel
 * as the image/video composer's ModelSelector (src/components/composer/
 * ModelSelector.tsx), adapted for muapi's 25-model LLM catalog and its
 * per-million-token pricing instead of per-generation cost. Deliberately a
 * separate component rather than a generic wrapper around the existing one
 * — the two catalogs have different shapes (ModelConfig vs LlmModelOption)
 * and different pricing units, and forcing one component to branch on both
 * would cost more clarity than the ~150 lines this duplicates.
 */
export function LlmModelSelector({
  value,
  onChange,
  disabled,
  disabledReason,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number }>({ bottom: 0, left: 0, width: 400 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = getLlmModel(value);

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
      const width = Math.min(400, vw - 24);
      const left = Math.max(12, Math.min(rect.left, vw - width - 12));
      setPos({ bottom: vh - rect.top + 8, left, width });
    }
    setQuery("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LLM_MODELS;
    return LLM_MODELS.filter((m) => m.label.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
  }, [query]);

  const searching = query.trim().length > 0;
  const featured = useMemo(() => filtered.filter((m) => m.recommended), [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, LlmModelOption[]>();
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
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        onClick={() => (disabled ? undefined : open ? setOpen(false) : openPanel())}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 pl-2 pr-2.5 py-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors",
          disabled && "opacity-60"
        )}
      >
        <ProviderAvatar provider={selected.provider} size={13} />
        {selected.label}
        {!disabled && <ChevronDown className="h-3 w-3" />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: `calc(100vh - ${pos.bottom}px - 16px)`,
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
                  placeholder="Search models"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-2 py-8 text-center text-xs text-muted">No models match &ldquo;{query}&rdquo;</div>
              )}

              {!searching && featured.length > 0 && (
                <div className="mb-1">
                  <div className="panel-label px-2.5 py-1.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recommended
                  </div>
                  {featured.map((m) => (
                    <ModelRow key={`featured-${m.id}`} m={m} isSelected={m.id === selected.id} onSelect={() => pick(m.id)} />
                  ))}
                </div>
              )}

              {searching ? (
                filtered.map((m) => (
                  <ModelRow key={`search-${m.id}`} m={m} isSelected={m.id === selected.id} onSelect={() => pick(m.id)} />
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
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                        </button>
                        {isOpen && (
                          <div className="ml-3 border-l border-border-subtle pl-1.5">
                            {group.map((m) => (
                              <ModelRow key={m.id} m={m} isSelected={m.id === selected.id} onSelect={() => pick(m.id)} />
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
