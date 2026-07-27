"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, LayoutTemplate, Search, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadReferenceFile } from "@/lib/upload";
import { useCuratedReferences, type RefCategory, type ImageRefCategory } from "@/hooks/useCuratedReferences";
import { useUserReferences } from "@/hooks/useUserReferences";
import { IMAGE_CATEGORIES, TAG_CATEGORIES } from "@/components/composer/ReferencePicker";
import { CAMERA_TAGS, EFFECT_TAGS, COLOR_PALETTES } from "@/lib/referenceTags";
import { formatErrorMessage } from "@/lib/errorFormat";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

function isImageCategory(c: RefCategory): c is ImageRefCategory {
  return c === "style" || c === "character" || c === "location" || c === "element";
}

/**
 * Full-page counterpart to the composer's ReferencePicker modal — the same
 * Style/Character/Location/Element/Color/Effects/Camera categories, but as a
 * standalone browsable/manageable page (Magnific calls this "Library") with
 * one thing the in-composer picker doesn't need: deleting your own saved
 * references. Uploading+saving here works the same as in the composer, it
 * just isn't wired to also add itself as a live prompt reference (there's no
 * generation in progress to attach it to).
 */
export function LibraryView() {
  const [category, setCategory] = useState<RefCategory>("style");
  const [source, setSource] = useState<"curated" | "library">("curated");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const imageCategory = isImageCategory(category);
  const { references: curated, loading: curatedLoading } = useCuratedReferences(category);
  const {
    references: userRefs,
    loading: userLoading,
    saveUserReference,
    deleteUserReference,
  } = useUserReferences(imageCategory ? category : undefined);

  function switchCategory(c: RefCategory) {
    setCategory(c);
    setSource("curated");
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
      setSavingUrl(url);
      setNameDraft("");
      setSource("library");
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

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <aside className="hidden sm:flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle/60 p-3">
        <div className="px-2.5 py-1.5 panel-label">References</div>
        {IMAGE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => switchCategory(c.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors text-left",
              category === c.id ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            )}
          >
            <c.icon className="h-[15px] w-[15px] shrink-0" />
            {c.label}
          </button>
        ))}
        <div className="mt-2 px-2.5 py-1.5 panel-label">Tags</div>
        {TAG_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => switchCategory(c.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors text-left",
              category === c.id ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            )}
          >
            <c.icon className="h-[15px] w-[15px] shrink-0" />
            {c.label}
          </button>
        ))}
        <div className="mt-2 px-2.5 py-1.5 panel-label">Custom</div>
        <Link
          href="/templates"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2/60 hover:text-foreground transition-colors"
        >
          <LayoutTemplate className="h-[15px] w-[15px] shrink-0" />
          Templates
        </Link>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight font-display capitalize flex-1">{category}</h1>
            <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 focus-within:border-accent transition-colors w-64">
              <Search className="h-3.5 w-3.5 text-muted shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${category}…`}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
              />
            </div>
          </div>

          {imageCategory ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex w-fit items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
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
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {savingUrl && (
                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/40 p-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={savingUrl} alt="" className="h-full w-full object-cover" />
                  </div>
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

              {source === "curated" ? (
                curatedLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square rounded-xl shimmer" />
                    ))}
                  </div>
                ) : filteredCurated.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted">
                    No curated {category} picks yet — check back soon, or upload your own above.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                    {filteredCurated.map((r) => (
                      <div key={r.id} className="flex flex-col gap-1">
                        <div className="aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
                          {r.image_url || r.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url || r.thumbnail_url || ""} alt={r.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="truncate text-[11px] text-muted">{r.name}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : userLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl shimmer" />
                  ))}
                </div>
              ) : filteredUser.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">
                  You haven&apos;t saved any {category} references yet — upload one above and give it a name to reuse it later.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
                  {filteredUser.map((r) => (
                    <div key={r.id} className="group relative flex flex-col gap-1">
                      <div className="aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[11px] text-muted">{r.name}</span>
                        <button
                          onClick={() => setDeleting({ id: r.id, name: r.name })}
                          title="Delete"
                          className="icon-btn-round !h-5 !w-5 shrink-0 opacity-0 transition-opacity hover:!bg-danger/20 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3 text-danger-text" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : category === "color" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredPalettes.map((p) => (
                <div key={p.name} title={p.colors.join(", ")} className="overflow-hidden rounded-xl border border-border-subtle">
                  <div className="flex h-14 w-full">
                    {p.colors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="px-2 py-1.5 text-xs font-medium">{p.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredTags.map((t) => (
                <span
                  key={t.label}
                  className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium"
                >
                  #{t.label}
                </span>
              ))}
            </div>
          )}

          {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title={`Delete "${deleting.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            deleteUserReference(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
