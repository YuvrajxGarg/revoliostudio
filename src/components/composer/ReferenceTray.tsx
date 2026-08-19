"use client";

import { Fragment, useRef, useState } from "react";
import { Plus, X, Pencil, Eye, ImageUp, Link2, Trash2, type LucideIcon } from "lucide-react";
import { useComposerStore } from "@/store/composerStore";
import type { ReferenceImage } from "@/lib/types";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";

export interface ReferenceQuickPick {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** A single filled reference tile — the image, its rename-on-click label, and a remove button. Shared by both the per-category slot groups and the plain (uncategorized) uploads below them. */
function RefThumb({
  item,
  editing,
  draftName,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
  onRemove,
  onView,
  onContextMenu,
  onAddMore,
}: {
  item: ReferenceImage;
  editing: boolean;
  draftName: string;
  onStartEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onView: () => void;
  /** Right-click on the tile — opens the actions menu (replace/view/rename/remove). */
  onContextMenu: (e: React.MouseEvent) => void;
  /** Only set on the last tile of a category group — opens the picker to add another to this same category, rather than a separate tile taking up its own spot in the row. */
  onAddMore?: () => void;
}) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      {/* The remove/add-more buttons sit OUTSIDE this inner overflow-hidden
          box (as siblings in the outer `relative group`, not this one) —
          nesting them inside the same overflow-hidden container as the
          image clips off the part that pokes past the corner. */}
      <div className="group relative h-14 w-14 shrink-0" onContextMenu={onContextMenu}>
        <div className="h-full w-full overflow-hidden rounded-lg border border-border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.name}
            title="Click to view full size"
            onClick={onView}
            className="h-full w-full cursor-pointer object-cover transition-[filter] hover:brightness-90"
          />
        </div>
        <button
          onClick={onRemove}
          title="Remove"
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground opacity-0 shadow-md transition-opacity hover:border-danger/40 hover:bg-danger/10 hover:text-danger-text group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
        {onAddMore && (
          <button
            onClick={onAddMore}
            title="Add another"
            className="absolute top-5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground opacity-0 shadow-md transition-opacity hover:border-accent/50 hover:text-accent group-hover:opacity-100"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          className="w-16 rounded border border-accent bg-surface-2 px-1 py-0.5 text-center text-[10px] outline-none"
        />
      ) : (
        <button
          onClick={onStartEdit}
          className="flex max-w-full items-center gap-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
          title="Click to rename — used for @mentions"
        >
          <span className="max-w-[3.5rem] truncate">{item.name}</span>
          <Pencil className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      )}
    </div>
  );
}

export function ReferenceTray({
  max,
  label,
  imageCategories,
  tagCategories,
  onOpenCategory,
}: {
  max: number;
  label?: string;
  /** Style/Character/Location/Element — each renders as ONE fixed-position box: an icon+label trigger when nothing's been picked for it yet, or the picked image(s) once you have — with a compact "add more" tile after so a second Character (say) lands right next to the first instead of a new row starting elsewhere. */
  imageCategories?: ReferenceQuickPick[];
  /** Color/Effects/Camera — pure prompt-modifier tags, so these always stay a plain icon+label trigger; there's nothing to "fill" since picking one doesn't add an image. */
  tagCategories?: ReferenceQuickPick[];
  onOpenCategory?: (id: string) => void;
}) {
  const { references, addReference, removeReference, renameReference, replaceReference } = useComposerStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; ref: ReferenceImage } | null>(null);
  // Which reference the pending replace file-pick belongs to — set when
  // "Replace image" is clicked in the menu, consumed by handleReplaceFile.
  const replacingIdRef = useRef<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (useComposerStore.getState().references.length >= max) break;
      try {
        const { url } = await uploadReferenceFile(file);
        // Auto-name as "Image N" rather than the raw filename — matches
        // the Reference's @-taggable reference naming.
        addReference(url, undefined, max);
      } catch (err) {
        // Used to fail silently (e.g. an image over muapi's 25MB cap) —
        // the file picker would just close with nothing added and no clue
        // why. Now the real error message shows up here.
        setError(err instanceof Error ? err.message : "Failed to upload image — check your connection and try again");
      }
    }
  }

  async function handleReplaceFile(files: FileList | null) {
    const file = files?.[0];
    const targetId = replacingIdRef.current;
    replacingIdRef.current = null;
    if (!file || !targetId || !file.type.startsWith("image/")) return;
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      replaceReference(targetId, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image — check your connection and try again");
    }
  }

  function buildMenuItems(ref: ReferenceImage): ContextMenuItem[] {
    return [
      {
        label: "Replace image",
        icon: <ImageUp className="h-4 w-4" />,
        onClick: () => {
          replacingIdRef.current = ref.id;
          replaceInputRef.current?.click();
        },
      },
      { label: "View full size", icon: <Eye className="h-4 w-4" />, onClick: () => setViewingUrl(ref.url) },
      { label: "Rename", icon: <Pencil className="h-4 w-4" />, onClick: () => startEditing(ref.id, ref.name) },
      {
        label: "Copy image URL",
        icon: <Link2 className="h-4 w-4" />,
        onClick: () => navigator.clipboard?.writeText(ref.url).catch(() => {}),
      },
      {
        label: "Remove",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        separatorBefore: true,
        onClick: () => removeReference(ref.id),
      },
    ];
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setDraftName(currentName);
  }

  function commitEdit() {
    if (editingId) renameReference(editingId, draftName);
    setEditingId(null);
  }

  if (max <= 0) return null;

  const atMax = references.length >= max;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="px-1 text-xs text-muted">{label}</span>}
      {/* Fixed 3-column grid, not flex-wrap or auto-fill: every tile
          (upload, empty category, filled thumbnail, tag) sits in an equal
          1/3-width column so rows fill the panel edge-to-edge with no dead
          space, and stay aligned across wraps — flex-wrap (and auto-fill,
          which reserves extra empty tracks past the last item) both left a
          gap on the right of partially-filled rows. */}
      <div className="grid grid-cols-4 items-start justify-items-center gap-x-2 gap-y-3 px-1">
        {!atMax && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border-subtle text-muted transition-colors hover:border-foreground/40 hover:text-foreground">
              <Plus className="h-4 w-4" />
            </div>
            <span className="truncate text-[10px] text-muted">Add</span>
          </button>
        )}

        {imageCategories?.map((cat) => {
          const items = references.filter((r) => r.category === cat.id);
          if (items.length === 0) {
            return (
              <button
                key={cat.id}
                onClick={() => onOpenCategory?.(cat.id)}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted transition-colors hover:border-foreground/40 hover:text-foreground">
                  <cat.icon className="h-4 w-4" />
                </div>
                <span className="truncate text-[10px] text-muted">{cat.label}</span>
              </button>
            );
          }
          return (
            <Fragment key={cat.id}>
              {items.map((ref, i) => (
                <RefThumb
                  key={ref.id}
                  item={ref}
                  editing={editingId === ref.id}
                  draftName={draftName}
                  onStartEdit={() => startEditing(ref.id, ref.name)}
                  onDraftChange={setDraftName}
                  onCommitEdit={commitEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onRemove={() => removeReference(ref.id)}
                  onView={() => setViewingUrl(ref.url)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, ref });
                  }}
                  onAddMore={!atMax && i === items.length - 1 ? () => onOpenCategory?.(cat.id) : undefined}
                />
              ))}
            </Fragment>
          );
        })}

        {tagCategories?.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onOpenCategory?.(cat.id)}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted transition-colors hover:border-foreground/40 hover:text-foreground">
              <cat.icon className="h-4 w-4" />
            </div>
            <span className="truncate text-[10px] text-muted">{cat.label}</span>
          </button>
        ))}

        {references
          .filter((r) => !r.category)
          .map((ref) => (
            <RefThumb
              key={ref.id}
              item={ref}
              editing={editingId === ref.id}
              draftName={draftName}
              onStartEdit={() => startEditing(ref.id, ref.name)}
              onDraftChange={setDraftName}
              onCommitEdit={commitEdit}
              onCancelEdit={() => setEditingId(null)}
              onRemove={() => removeReference(ref.id)}
              onView={() => setViewingUrl(ref.url)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, ref });
              }}
            />
          ))}

        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleReplaceFile(e.target.files);
            // Reset so picking the same file again still fires onChange.
            e.target.value = "";
          }}
        />
      </div>
      {error && <div className="px-1 text-[11px] text-danger-text">{formatErrorMessage(error).message}</div>}
      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={buildMenuItems(menu.ref)} onClose={() => setMenu(null)} />}
    </div>
  );
}
