"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useComposerStore } from "@/store/composerStore";

interface MentionItem {
  id: string;
  url: string;
  label: string;
}

export function MentionPopover({
  query,
  onSelect,
  onClose,
  direction = "up",
}: {
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  /** Which way the popover opens. "down" avoids clipping in narrow scrollable
   * sidebars (e.g. the Video composer) where opening upward gets cut off by
   * the sidebar's own top edge. */
  direction?: "up" | "down";
}) {
  const references = useComposerStore((s) => s.references);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const ownRefs: MentionItem[] = references
    .map((r) => ({ id: r.id, url: r.url, label: r.name }))
    .filter((r) => (query ? r.label.toLowerCase().includes(query.toLowerCase()) : true));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("generations")
        .select("id, prompt, model_label, thumbnail_url, output_urls, category, seq_number")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(30);

      if (cancelled) return;
      const mapped: MentionItem[] = (data ?? [])
        .map((g: { id: string; prompt: string | null; model_label: string | null; thumbnail_url: string | null; output_urls: string[] | null; seq_number: number | null }) => {
          const url = g.thumbnail_url || g.output_urls?.[0];
          if (!url) return null;
          const label = g.seq_number
            ? `revoliostudio_${String(g.seq_number).padStart(3, "0")}`
            : (g.prompt?.slice(0, 24) || g.model_label || "image").trim();
          return { id: g.id, url, label };
        })
        .filter(Boolean) as MentionItem[];

      const filtered = query
        ? mapped.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
        : mapped;

      setItems(filtered.slice(0, 12));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div
      className={`absolute left-0 w-72 max-h-80 overflow-y-auto rounded-xl border border-border-subtle bg-surface shadow-2xl z-50 p-2 ${
        direction === "down" ? "top-full mt-2" : "bottom-full mb-2"
      }`}
    >
      {ownRefs.length > 0 && (
        <>
          <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Your references
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {ownRefs.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border-subtle hover:border-accent transition-colors"
                title={item.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Tag an image from your gallery
      </div>
      {loading && <div className="px-1 py-3 text-xs text-muted">Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="px-1 py-3 text-xs text-muted">No matching generations yet.</div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="group relative aspect-square rounded-lg overflow-hidden border border-border-subtle hover:border-accent transition-colors"
            title={item.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-1.5 w-full text-center text-[11px] text-muted hover:text-foreground py-1"
      >
        Esc to close
      </button>
    </div>
  );
}
