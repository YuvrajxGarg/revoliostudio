"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Resource, ResourceCategory, ResourceInput } from "@/hooks/useResources";

const CATEGORIES: ResourceCategory[] = ["editing", "design", "ai-tools", "plugins", "stock", "learning"];

/** Admin-only add/edit form for a resources-bank entry. */
export function ResourceEditorModal({
  resource,
  onClose,
  onSave,
}: {
  resource: Resource | null;
  onClose: () => void;
  onSave: (input: ResourceInput) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [category, setCategory] = useState<ResourceCategory>(resource?.category ?? "ai-tools");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [downloadUrl, setDownloadUrl] = useState(resource?.download_url ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(resource?.thumbnail_url ?? "");
  const [tags, setTags] = useState((resource?.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !url.trim()) {
      setError("Title and URL are required");
      return;
    }
    setSaving(true);
    setError(null);
    const thumb =
      thumbnailUrl.trim() ||
      (() => {
        try {
          return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`;
        } catch {
          return null;
        }
      })();
    const err = await onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      url: url.trim(),
      download_url: downloadUrl.trim() || null,
      thumbnail_url: thumb,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
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
          <h2 className="text-sm font-semibold">{resource ? "Edit resource" : "Add resource"}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div>
            <div className="panel-label pb-1">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="e.g. Blender" />
          </div>
          <div>
            <div className="panel-label pb-1">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={field + " resize-none"}
              placeholder="One or two lines on what it's for…"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="panel-label pb-1">Category</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                className={field}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="panel-label pb-1">Tags (comma-separated)</div>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className={field} placeholder="free, video" />
            </div>
          </div>
          <div>
            <div className="panel-label pb-1">Website URL</div>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://…" />
          </div>
          <div>
            <div className="panel-label pb-1">Download URL (optional)</div>
            <input
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              className={field}
              placeholder="Direct download page…"
            />
          </div>
          <div>
            <div className="panel-label pb-1">Thumbnail URL (optional — favicon is auto-derived)</div>
            <input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className={field}
              placeholder="https://…/logo.png"
            />
          </div>

          {error && <div className="text-xs text-danger-text">{error}</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-2"
          >
            {saving ? "Saving…" : resource ? "Save changes" : "Add resource"}
          </button>
        </div>
      </div>
    </div>
  );
}
