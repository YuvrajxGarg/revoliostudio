"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useComposerStore } from "@/store/composerStore";
import { useUserReferences, characterAssetUrls } from "@/hooks/useUserReferences";
import { useCuratedReferences } from "@/hooks/useCuratedReferences";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  /** The URL that actually becomes the attached reference. For a saved
   * character this is its poster (or first shot) — never the plain source
   * face photo, see extraUrls' doc comment. */
  url: string;
  label: string;
  /** Shown in the tile instead of `url` when set — only differs from `url`
   * for a character with no generated assets yet, where the tile still
   * previews the face photo even though nothing's attached from it. */
  thumbnailUrl?: string;
  /** Extra reference images that ride along with `url` when this item is
   * picked — a saved character's *other* generated shots (see
   * GenerateTab's "Save character…" and characterAssetUrls). Deliberately
   * never includes the character's original uploaded face photo: once a
   * sheet exists, the poster/shots are the useful "this is the character"
   * references, not the raw selfie used to make them. */
  extraUrls?: string[];
  /** Use this item's own `label` as the added reference's name instead of
   * the usual auto "Image N" — so tagging "@Alex" actually shows "Alex" in
   * the reference tray, not a generic index. */
  useLabelAsName?: boolean;
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
  const { references: savedCharacters } = useUserReferences("character");
  const { references: curatedCharacters } = useCuratedReferences("character");

  const ownRefs: MentionItem[] = references
    .map((r) => ({ id: r.id, url: r.url, label: r.name }))
    .filter((r) => (query ? r.label.toLowerCase().includes(query.toLowerCase()) : true));

  // Saved characters (Character Studio's "Save character…") get their own
  // section rather than being folded into "Your references" — picking one
  // attaches its generated shots/poster (see characterAssetUrls) instead of
  // the plain face photo, and the @mention uses the character's real name
  // instead of a generic "Image N". A character with no generated assets yet
  // (saved before ever running a sheet) falls back to the face photo — it's
  // all there is to attach in that case.
  function toMentionItems(list: { id: string; name: string; image_url: string; shot_urls: string[]; poster_url: string | null }[]): MentionItem[] {
    return list
      .map((r) => {
        const assets = characterAssetUrls(r);
        const [primary, ...rest] = assets.length > 0 ? assets : [r.image_url];
        return {
          id: r.id,
          url: primary,
          label: r.name,
          thumbnailUrl: r.poster_url || r.image_url,
          extraUrls: rest,
          useLabelAsName: true,
        };
      })
      .filter((r) => (query ? r.label.toLowerCase().includes(query.toLowerCase()) : true));
  }

  const characterRefs = toMentionItems(savedCharacters);
  // Community-published characters (see publishCharacter) — anyone can tag
  // these, not just their original creator.
  const communityCharacterRefs = toMentionItems(
    curatedCharacters.map((c) => ({
      id: c.id,
      name: c.name,
      image_url: c.image_url ?? "",
      shot_urls: c.shot_urls,
      poster_url: c.poster_url,
    }))
  ).filter((c) => c.url);

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
      {characterRefs.length > 0 && (
        <CharacterMentionSection title="Your characters" items={characterRefs} onSelect={onSelect} />
      )}
      {communityCharacterRefs.length > 0 && (
        <CharacterMentionSection title="Community characters" items={communityCharacterRefs} onSelect={onSelect} />
      )}

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

function CharacterMentionSection({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: MentionItem[];
  onSelect: (item: MentionItem) => void;
}) {
  return (
    <>
      <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="group relative aspect-square rounded-lg overflow-hidden border border-border-subtle bg-surface-2 hover:border-accent transition-colors"
            title={`${item.label}${item.extraUrls?.length ? ` (+${item.extraUrls.length} shots)` : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbnailUrl || item.url}
              alt={item.label}
              className={cn("h-full w-full", item.thumbnailUrl ? "object-contain" : "object-cover")}
            />
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
