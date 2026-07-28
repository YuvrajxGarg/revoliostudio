"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Palette,
  Shapes,
  Sparkles,
  SlidersHorizontal,
  Search,
  Upload,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadReferenceFile } from "@/lib/upload";
import { useCuratedReferences, type RefCategory, type ImageRefCategory } from "@/hooks/useCuratedReferences";
import { useUserReferences, characterAssetUrls } from "@/hooks/useUserReferences";
import { CAMERA_TAGS, EFFECT_TAGS, COLOR_PALETTES } from "@/lib/referenceTags";
import { formatErrorMessage } from "@/lib/errorFormat";

export const IMAGE_CATEGORIES: { id: ImageRefCategory; label: string; icon: LucideIcon }[] = [
  { id: "style", label: "Style", icon: Sparkles },
  { id: "character", label: "Character", icon: User },
  { id: "location", label: "Location", icon: MapPin },
  { id: "element", label: "Element", icon: Shapes },
];

export const TAG_CATEGORIES: { id: RefCategory; label: string; icon: LucideIcon }[] = [
  { id: "color", label: "Color", icon: Palette },
  { id: "effects", label: "Effects", icon: SlidersHorizontal },
  { id: "camera", label: "Camera", icon: CameraIcon },
];

export type ReferencePickResult =
  | {
      type: "image";
      url: string;
      name: string;
      category: ImageRefCategory;
      promptModifier?: string;
      /** A saved character's own generated shots (character_sheets output,
       * see GenerateTab's "Save character…"), tagged along automatically when
       * you pick that character from Your Library — so tagging one character
       * hands the generation several consistent angles/poses to work from
       * instead of just the one source photo. */
      extraUrls?: string[];
    }
  | { type: "prompt"; text: string };

function isImageCategory(c: RefCategory): c is ImageRefCategory {
  return c === "style" || c === "character" || c === "location" || c === "element";
}

function SidebarButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
        active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground hover:bg-surface-2/60"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

function ImageTile({ url, name, onClick }: { url: string; name: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={name} className="group flex flex-col gap-1 text-left">
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-2 transition-colors group-hover:border-accent/50">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <span className="truncate text-[11px] text-muted transition-colors group-hover:text-foreground">{name}</span>
    </button>
  );
}

function UploadTile({ uploading, onFile }: { uploading: boolean; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border-subtle text-muted transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </button>
      <span className="text-center text-[11px] text-muted">Upload</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Magnific-style Reference Library — a browsable picker for Style /
 * Character / Location / Element image references, plus Camera / Effects /
 * Color prompt-modifier tags. Everything here is optional and additive:
 * picking an image category tile adds it as another reference image (same
 * `references` array PromptComposer already sends to generation — no new
 * plumbing needed there), while a Camera/Effects/Color pick just appends a
 * short phrase to the prompt text. The panel stays open after each pick so
 * you can stack a Style + a Location + a Camera tag in one session, closing
 * only when you're done (X, Escape, or clicking the backdrop).
 *
 * Portaled to document.body for the same reason every other fullscreen
 * overlay in this app is (see PromptEditorModal) — opened from inside a
 * backdrop-blur composer panel, a plain `fixed inset-0` would otherwise be
 * clipped to that panel's own bounds instead of the real viewport.
 */
export function ReferencePicker({
  initialCategory = "style",
  onApply,
  onClose,
}: {
  initialCategory?: RefCategory;
  onApply: (result: ReferencePickResult) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [category, setCategory] = useState<RefCategory>(initialCategory);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"curated" | "library">("curated");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const imageCategory = isImageCategory(category);
  const { references: curated, loading: curatedLoading } = useCuratedReferences(category);
  const { references: userRefs, loading: userLoading, saveUserReference } = useUserReferences(
    imageCategory ? category : undefined
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function switchCategory(c: RefCategory) {
    setCategory(c);
    setQuery("");
    setSavingUrl(null);
    setError(null);
  }

  const q = query.trim().toLowerCase();
  const filteredCurated = curated.filter((r) => r.name.toLowerCase().includes(q));
  const filteredUser = userRefs.filter((r) => r.name.toLowerCase().includes(q));
  const filteredTags = (category === "camera" ? CAMERA_TAGS : category === "effects" ? EFFECT_TAGS : []).filter((t) =>
    t.label.toLowerCase().includes(q)
  );
  const filteredPalettes = COLOR_PALETTES.filter((p) => p.name.toLowerCase().includes(q));

  async function handleUpload(file: File) {
    if (!imageCategory) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadReferenceFile(file);
      onApply({ type: "image", url, name: category, category });
      setSavingUrl(url);
      setNameDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function confirmSaveName() {
    if (!savingUrl || !nameDraft.trim() || !imageCategory) return;
    const err = await saveUserReference({ category, name: nameDraft.trim(), image_url: savingUrl });
    if (!err) {
      setSavingUrl(null);
      setNameDraft("");
    } else {
      setError(err);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div
        className="flex h-[80vh] max-h-[640px] w-full max-w-4xl overflow-hidden rounded-2xl border border-border-subtle bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle bg-surface-2/40 p-2">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted">References</div>
          {IMAGE_CATEGORIES.map((c) => (
            <SidebarButton key={c.id} active={category === c.id} icon={c.icon} label={c.label} onClick={() => switchCategory(c.id)} />
          ))}
          <div className="mt-2 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted">Prompt tags</div>
          {TAG_CATEGORIES.map((c) => (
            <SidebarButton key={c.id} active={category === c.id} icon={c.icon} label={c.label} onClick={() => switchCategory(c.id)} />
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border-subtle p-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${category}`}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
            <button onClick={onClose} title="Close" className="icon-btn-round shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {imageCategory ? (
              <>
                <div className="mb-3 flex w-fit items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
                  <button
                    onClick={() => setSource("curated")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      source === "curated" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    By Revolio
                  </button>
                  <button
                    onClick={() => setSource("library")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      source === "library" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    Your library
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                  <UploadTile uploading={uploading} onFile={handleUpload} />
                  {source === "curated" &&
                    filteredCurated.map((r) => {
                      // A published character (see useUserReferences'
                      // publishCharacter) carries its own shots/poster the
                      // same way a saved-but-unpublished one does — tag it
                      // the same way: poster/shots as the reference, never
                      // the plain face photo, see characterAssetUrls.
                      const assets = category === "character" ? characterAssetUrls(r) : [];
                      const fallback = r.image_url || r.thumbnail_url || "";
                      const [primary, ...rest] = assets.length > 0 ? assets : [fallback];
                      return (
                        <ImageTile
                          key={r.id}
                          url={r.poster_url || fallback}
                          name={r.name}
                          onClick={() =>
                            onApply({
                              type: "image",
                              url: primary,
                              name: r.name,
                              category,
                              promptModifier: r.prompt_modifier ?? undefined,
                              extraUrls: rest.length > 0 ? rest : undefined,
                            })
                          }
                        />
                      );
                    })}
                  {source === "library" &&
                    filteredUser.map((r) => {
                      const assets = category === "character" ? characterAssetUrls(r) : [];
                      const [primary, ...rest] = assets.length > 0 ? assets : [r.image_url];
                      return (
                        <ImageTile
                          key={r.id}
                          url={r.poster_url || r.image_url}
                          name={r.name}
                          onClick={() =>
                            onApply({
                              type: "image",
                              url: primary,
                              name: r.name,
                              category,
                              extraUrls: rest.length > 0 ? rest : undefined,
                            })
                          }
                        />
                      );
                    })}
                </div>
                {source === "curated" && !curatedLoading && filteredCurated.length === 0 && (
                  <p className="mt-4 text-xs text-muted">
                    No curated {category} picks yet — check back soon, or upload your own above and save it for next time.
                  </p>
                )}
                {source === "library" && !userLoading && filteredUser.length === 0 && (
                  <p className="mt-4 text-xs text-muted">
                    You haven&apos;t saved any {category} references yet — upload one above and give it a name to reuse it later.
                  </p>
                )}
              </>
            ) : category === "color" ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {filteredPalettes.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => onApply({ type: "prompt", text: `${p.name} color palette` })}
                    title={p.colors.join(", ")}
                    className="overflow-hidden rounded-xl border border-border-subtle text-left transition-colors hover:border-accent/50"
                  >
                    <div className="flex h-14 w-full">
                      {p.colors.map((c, i) => (
                        <div key={i} className="flex-1" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="px-2 py-1.5 text-xs font-medium">{p.name}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => onApply({ type: "prompt", text: t.promptModifier })}
                    className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    #{t.label}
                  </button>
                ))}
              </div>
            )}
            {error && <div className="mt-3 text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
          </div>

          {savingUrl && imageCategory && (
            <div className="flex items-center gap-2 border-t border-border-subtle bg-surface-2/40 p-3">
              <span className="shrink-0 text-xs text-muted">Save as a reusable {category}?</span>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmSaveName()}
                placeholder={`Name it, e.g. "my brand style"`}
                className="flex-1 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <button
                onClick={confirmSaveName}
                disabled={!nameDraft.trim()}
                className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setSavingUrl(null)} className="shrink-0 text-xs text-muted hover:text-foreground">
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
