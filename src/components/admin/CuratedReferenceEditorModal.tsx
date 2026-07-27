"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import type { CuratedReference, CuratedReferenceInput, ImageRefCategory } from "@/hooks/useCuratedReferences";
import { uploadReferenceFile } from "@/lib/upload";

const CATEGORIES: ImageRefCategory[] = ["style", "character", "location", "element"];

/**
 * Admin-only add/edit form for a Reference Library entry. Scoped to the four
 * image-based categories (style/character/location/element) — Camera/
 * Effects/Color are static prompt-tag data (`src/lib/referenceTags.ts`), not
 * curated_references rows, so there's nothing to admin-edit for those here.
 */
export function CuratedReferenceEditorModal({
  reference,
  onClose,
  onSave,
}: {
  reference: CuratedReference | null;
  onClose: () => void;
  onSave: (input: CuratedReferenceInput) => Promise<string | null>;
}) {
  const [name, setName] = useState(reference?.name ?? "");
  const [category, setCategory] = useState<ImageRefCategory>((reference?.category as ImageRefCategory) ?? "style");
  const [imageUrl, setImageUrl] = useState(reference?.image_url ?? "");
  const [promptModifier, setPromptModifier] = useState(reference?.prompt_modifier ?? "");
  const [tags, setTags] = useState((reference?.tags ?? []).join(", "));
  const [sortOrder, setSortOrder] = useState(String(reference?.sort_order ?? 100));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !imageUrl.trim()) {
      setError("Name and image are required");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({
      name: name.trim(),
      category,
      image_url: imageUrl.trim(),
      thumbnail_url: imageUrl.trim(),
      prompt_modifier: promptModifier.trim() || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sort_order: Number(sortOrder) || 100,
    });
    setSaving(false);
    if (err) setError(err);
  }

  const field =
    "w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-sm font-semibold">{reference ? "Edit reference" : "Add reference"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="panel-label pb-1">Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="e.g. Editorial noir" />
            </div>
            <div>
              <div className="panel-label pb-1">Category</div>
              <select value={category} onChange={(e) => setCategory(e.target.value as ImageRefCategory)} className={field}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="panel-label pb-1">Image</div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="mb-1.5 h-24 w-24 rounded-lg border border-border-subtle object-cover" />
            )}
            <div className="flex items-center gap-1.5">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={field}
                placeholder="https://…/image.jpg or upload"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload"
                className="icon-btn-round shrink-0 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={fileInputRef}
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
          </div>

          <div>
            <div className="panel-label pb-1">Prompt modifier (optional)</div>
            <input
              value={promptModifier}
              onChange={(e) => setPromptModifier(e.target.value)}
              className={field}
              placeholder="Extra text appended to the prompt when picked"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="panel-label pb-1">Tags (comma-separated)</div>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className={field} placeholder="editorial, moody" />
            </div>
            <div>
              <div className="panel-label pb-1">Sort order</div>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={field}
              />
            </div>
          </div>

          {error && <div className="text-xs text-danger-text">{error}</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white hover:bg-accent-2 disabled:opacity-40"
          >
            {saving ? "Saving…" : reference ? "Save changes" : "Add reference"}
          </button>
        </div>
      </div>
    </div>
  );
}
