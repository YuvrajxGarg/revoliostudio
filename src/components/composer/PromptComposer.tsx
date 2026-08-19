"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Eye, Loader2, Plus, SquarePen, Trash2, Video, X } from "lucide-react";
import { useComposerStore, type ActivePreset } from "@/store/composerStore";
import { Category, DEFAULT_MODEL_ID, EDIT_COUNTERPART, ModelConfig, modelsByCategory } from "@/lib/models";
import { cn } from "@/lib/utils";
import { GenerateIcon } from "@/components/ui/GenerateIcon";
import { ModelSelector } from "./ModelSelector";
import { ReferenceTray, type ReferenceQuickPick } from "./ReferenceTray";
import { FrameSlots } from "./FrameSlots";
import { SettingsBar } from "./SettingsBar";
import { MentionPopover, type MentionItem } from "./MentionPopover";
import { MentionHighlightTextarea } from "./MentionHighlightTextarea";
import { PromptEditorModal } from "./PromptEditorModal";
import { ReferencePicker, IMAGE_CATEGORIES, TAG_CATEGORIES, type ReferencePickResult } from "./ReferencePicker";
import type { RefCategory } from "@/hooks/useCuratedReferences";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import type { ModelSchemaInfo } from "@/lib/model-schema-types";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

// Reuses the exact same category lists ReferencePicker's own left nav uses,
// so adding a category there automatically shows up here too. Kept as two
// separate lists (not one merged array) because ReferenceTray treats them
// differently: the image categories fill in-place with the picked photo(s),
// the tag categories always stay a plain trigger (see ReferenceTray.tsx).
const REFERENCE_IMAGE_CATEGORIES: ReferenceQuickPick[] = IMAGE_CATEGORIES;
const REFERENCE_TAG_CATEGORIES: ReferenceQuickPick[] = TAG_CATEGORIES;

// The generation models here have no concept of "this attached image is the
// style ref, that one's the character ref" — images_list is just a flat,
// unlabeled array. With only ONE reference attached, a vague unindexed
// phrase ("matching the visual style of...") is unambiguous enough. The
// moment a SECOND category reference joins it (Style + Character, say),
// that ambiguity breaks: the model has no way to tell which of the two
// images "the style reference" refers to. The fix is positional labeling —
// "Image 2 is the style reference" — which Nano Banana 2 Edit, GPT Image 2,
// and Flux Kontext are all specifically documented/trained to understand
// ("apply the style from image 1 to the subject in image 2" is a standard
// multi-image editing prompt pattern for these models).
//
// This is computed at GENERATE time (see buildAnnotatedPrompt below), not
// baked into the visible prompt textbox the moment a reference is picked.
// Building it fresh from the live `references` array means the indices
// always match the actual positions those references occupy in the
// `references.map(r => r.url)` images_list sent to /api/generate — even if
// you add a Style ref, then a Character ref, then remove the Style one
// before hitting Generate. Baking the number in at pick-time (the previous
// approach) couldn't survive that: removing/reordering a reference left
// stale "Image 2" text pointing at the wrong picture. The visible prompt
// box also stays exactly what you typed — no auto-appended clauses cluttering
// it while you're still composing.
//
// The tray's "add more" button (see ReferenceTray's onAddMore) lets several
// images share ONE category slot — e.g. three photos of the same character,
// which is exactly how these models expect multi-image identity consistency
// to be fed in. Emitting one clause per image in that case ("Image 2 is the
// character reference — keep consistent", "Image 3 is the character
// reference — keep consistent", ...) is misleading — it reads as N separate
// unrelated characters, not N photos of one. So `group` always holds every
// image filed under the same category and `indices` their positions; a
// single-image group keeps the original per-image wording, a multi-image
// group collapses into one clause spanning all of them.
function buildReferenceModifier(
  category: string,
  group: { name: string; promptModifier?: string }[],
  indices: number[]
): string | null {
  const label =
    category === "style"
      ? "style"
      : category === "character"
        ? "character"
        : category === "location"
          ? "location"
          : category === "element"
            ? "element"
            : null;
  if (!label) return null;

  const subject = formatImageIndexList(indices);
  const isGroup = indices.length > 1;

  // A curated pick's admin-authored description ("moody editorial noir")
  // already IS the specific detail — anchor it to whichever image(s) it's
  // on. If a group somehow mixes a curated pick with plain uploads, the
  // curated description still wins (it's the more specific of the two).
  const curatedModifier = group.find((r) => r.promptModifier)?.promptModifier;
  if (curatedModifier) {
    return isGroup
      ? `${subject} are the ${label} reference: ${curatedModifier}`
      : `${subject} is the ${label} reference: ${curatedModifier}`;
  }

  // A pick-and-apply upload that was never named (or "Skip" on the
  // save-a-name prompt) gets `name` defaulted to the raw category id itself
  // (see ReferencePicker's handleUpload) — quoting that back ("named
  // \"style\"") is redundant noise, not a real description, so those fall
  // back to unnamed phrasing instead of a fake-looking quote. Multi-image
  // groups skip the name entirely — "these images are the same X" already
  // says what matters more than any one image's label.
  const hasRealName = !isGroup && group[0].name.trim().toLowerCase() !== category;
  const named = hasRealName ? ` ("${group[0].name}")` : "";

  switch (category) {
    case "style":
      return isGroup
        ? `${subject} are style references — match their shared visual style`
        : `${subject} is the style reference${named} — match its visual style`;
    case "character":
      return isGroup
        ? `${subject} are reference photos of the same character — keep this character consistent across all of them`
        : `${subject} is the character reference${named} — keep this character consistent`;
    case "location":
      return isGroup
        ? `${subject} show the same location — set the scene there`
        : `${subject} is the location reference${named} — set the scene there`;
    case "element":
      return isGroup
        ? `${subject} show the same element — include it`
        : `${subject} is the element reference${named} — include this element`;
    default:
      return null;
  }
}

/** "Image 2" / "Images 2 and 3" / "Images 2, 3, and 4" — 1-based, matches images_list order. */
function formatImageIndexList(indices: number[]): string {
  if (indices.length === 1) return `Image ${indices[0]}`;
  if (indices.length === 2) return `Images ${indices[0]} and ${indices[1]}`;
  const head = indices.slice(0, -1).join(", ");
  return `Images ${head}, and ${indices[indices.length - 1]}`;
}

// Assembles the actual text sent to /api/generate: the raw prompt the user
// typed, plus one modifier clause per reference category present — grouping
// every image filed under the same category (see buildReferenceModifier's
// comment) into a single clause rather than one per image. Called at submit
// time — see the comment above for why this can't be precomputed at pick
// time.
function buildAnnotatedPrompt(basePrompt: string, refs: { category?: string; name: string; promptModifier?: string }[]): string {
  const groups = new Map<string, { name: string; promptModifier?: string }[]>();
  const indicesByCategory = new Map<string, number[]>();
  refs.forEach((r, i) => {
    if (!r.category) return;
    if (!groups.has(r.category)) {
      groups.set(r.category, []);
      indicesByCategory.set(r.category, []);
    }
    groups.get(r.category)!.push(r);
    indicesByCategory.get(r.category)!.push(i + 1);
  });

  const clauses: string[] = [];
  groups.forEach((group, category) => {
    const modifier = buildReferenceModifier(category, group, indicesByCategory.get(category)!);
    if (modifier) clauses.push(modifier);
  });

  if (clauses.length === 0) return basePrompt;
  const joined = clauses.join(", ");
  return basePrompt.trim() ? `${basePrompt.trim()}, ${joined}` : joined;
}

// Combines a selected preset's own baked-in instruction with whatever extra
// detail the user typed into the (otherwise empty) prompt box — called only
// at submit time, same reasoning as buildAnnotatedPrompt above. The preset's
// prompt always leads (it's the actual effect instruction the model needs),
// with the user's freeform addition appended as further detail.
export function mergePresetPrompt(presetPrompt: string | undefined, userPrompt: string): string {
  const preset = presetPrompt?.trim();
  const user = userPrompt.trim();
  if (!preset) return userPrompt;
  if (!user) return preset;
  return `${preset} ${user}`;
}

/**
 * The active-preset preview card — thumbnail + title, shown at the top of
 * the composer once a template/preset has been picked (see
 * FeaturedTemplatesGrid's useTemplate). Mirrors Higgsfield's own composer,
 * where the selected effect sits as a card above the upload/prompt area
 * rather than dumping its prompt text into the textarea. "Change" clears it
 * so the user can pick something else (or just type a prompt from scratch).
 */
export function ActivePresetCard({ preset, onClear }: { preset: ActivePreset; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/5 p-2">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {preset.previewVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={preset.previewVideo}
            poster={preset.previewImage}
            muted
            loop
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
        ) : preset.previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preset.previewImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full accent-gradient" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{preset.title}</div>
        {preset.group && <div className="truncate text-[11px] text-muted">{preset.group}</div>}
      </div>
      <button
        onClick={onClear}
        title="Change template"
        className="shrink-0 rounded-lg border border-border-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        Change
      </button>
    </div>
  );
}

/**
 * Optional single-video reference slot, shown alongside the normal image
 * ReferenceTray for i2v/omni models whose live schema exposes a secondary
 * video field (see `videoReferenceField` on ModelSchemaInfo) — e.g. a
 * character-replace-style workflow that takes one image reference plus one
 * motion/scene video, without needing a separate Edit Video tab.
 */
function VideoReferenceSlot({
  video,
  uploading,
  onUpload,
  onClear,
}: {
  video: { url: string; name: string } | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [viewing, setViewing] = useState(false);

  // Right-click actions on a filled slot. "Replace video" reuses the same
  // hidden file input — onUpload overwrites the slot in place.
  const menuItems: ContextMenuItem[] = video
    ? [
        { label: "Replace video", icon: <Video className="h-4 w-4" />, onClick: () => inputRef.current?.click() },
        { label: "View full size", icon: <Eye className="h-4 w-4" />, onClick: () => setViewing(true) },
        { label: "Remove", icon: <Trash2 className="h-4 w-4" />, danger: true, separatorBefore: true, onClick: onClear },
      ]
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="panel-label">Video reference (optional)</div>
      {video ? (
        <div
          className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-2"
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={video.url} muted loop playsInline autoPlay className="w-full h-24 object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
          <button
            onClick={onClear}
            title="Remove video reference"
            className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text hover:border-danger/40 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle bg-surface-2 py-3 text-center text-muted hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          <span className="text-xs">Add a motion/scene video</span>
        </button>
      )}
      {/* Lives outside the empty-state label so "Replace video" from the
          right-click menu can reach it while the slot is filled too. */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      {viewing && video && <ImageLightbox url={video.url} mediaType="video" onClose={() => setViewing(false)} />}
    </div>
  );
}

export function PromptComposer({
  category,
  onGenerated,
  variant = "bottom",
  modelFilter,
  placeholder,
  transformPrompt,
  toolId,
}: {
  category: Category;
  onGenerated?: () => void;
  /** "bottom" = docked horizontal bar (Image/3D studios). "sidebar" = vertical left-rail layout (Video studio). */
  variant?: "bottom" | "sidebar";
  /** Optionally narrow which models of this category are selectable (e.g. exclude Edit Video / Motion Control modes from the "Create Video" tab). */
  modelFilter?: (m: ModelConfig) => boolean;
  /** Overrides the default textarea placeholder — used by the config-driven tool studios to give tool-specific guidance (e.g. "Describe your logo…") instead of the generic copy. */
  placeholder?: string;
  /** Wraps whatever the user typed with a fixed style template right before it's sent — e.g. Sticker Pack Generator adds "die-cut sticker style, bold outline…" so a plain subject description like "kratos from god of war" doesn't just come back as a photoreal image. The visible textarea/stored prompt is never mutated, only the submitted payload. */
  transformPrompt?: (prompt: string) => string;
  /** Tags every generation submitted from this composer instance with a config-driven tool studio's id (e.g. "stickers") so its gallery — and only its gallery — shows it. Omitted for the plain Image/Video/Audio/3D Generator, which is what keeps its own generations out of every tool studio's gallery and vice versa. */
  toolId?: string;
}) {
  const allModels = modelsByCategory(category);
  const models = modelFilter ? allModels.filter(modelFilter) : allModels;
  const {
    modelId,
    prompt,
    references,
    startFrame,
    endFrame,
    videoReference,
    settings,
    isSubmitting,
    hasHydrated,
    activePreset,
    setCategory,
    setModelId,
    setPrompt,
    addReference,
    setVideoReference,
    setSubmitting,
    setActivePreset,
    resetAfterSubmit,
    projectId,
    updateSettings,
  } = useComposerStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [schema, setSchema] = useState<ModelSchemaInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videoRefUploading, setVideoRefUploading] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [referencePickerCategory, setReferencePickerCategory] = useState<RefCategory | null>(null);

  // Cmd/Ctrl+E opens the expanded Prompt editor from anywhere in this
  // composer instance, matching the shortcut hint shown on its own trigger
  // button — scoped to whichever PromptComposer is actually mounted (Image/
  // Video/Audio/3D each render their own instance) rather than a single
  // global listener, so it can't fire twice or target the wrong studio.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setPromptEditorOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleVideoRefUpload(file: File) {
    setVideoRefUploading(true);
    setError(null);
    try {
      const { url } = await uploadReferenceFile(file);
      setVideoReference({ id: crypto.randomUUID(), url, name: "Video" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video — check your connection and try again");
    } finally {
      setVideoRefUploading(false);
    }
  }

  useEffect(() => {
    setCategory(category);
    // Wait for the persisted store to actually finish reading localStorage
    // before picking a "default" model — otherwise this runs once against
    // the store's hard-coded initial `modelId: null`, momentarily selects
    // the registry's first model (e.g. Nano Banana Pro), and then a second
    // render replaces it with the real last-used model once hydration
    // catches up — the exact flash this guard exists to prevent.
    if (!hasHydrated) return;
    // Also re-pick a default when the *currently* selected model has since
    // been flagged `unavailable` (e.g. this tab was open with Seedream 5.0
    // Lite Edit selected when it got disabled) — otherwise the composer
    // would sit on a dead model until the user manually switched.
    const current = models.find((m) => m.id === modelId);
    if (!modelId || !current || current.unavailable) {
      const preferredId = DEFAULT_MODEL_ID[category];
      const preferred = preferredId && models.find((m) => m.id === preferredId && !m.unavailable);
      const fallback = models.find((m) => !m.unavailable) ?? models[0];
      setModelId(preferred ? preferred.id : fallback?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, models.map((m) => m.id).join(","), hasHydrated]);

  // Same reasoning as the effect above: don't fall back to `models[0]`
  // until hydration has actually resolved the real persisted modelId, or
  // the very first paint renders the wrong model (and its settings —
  // e.g. a batch/numImages control the real model doesn't support) for one
  // frame before swapping.
  const model: ModelConfig | undefined = hasHydrated ? models.find((m) => m.id === modelId) ?? models[0] : undefined;
  const estimatedCostUSD = model ? estimateCostUSD(model, settings) : 0;

  // Fetched once here (rather than inside SettingsBar) so both the settings
  // row AND the reference-image cap below can use the model's real live
  // schema — the static registry's maxReferences can drift or be wrong
  // (several video models' true multi-image limits didn't match it).
  useEffect(() => {
    setSchema(null);
    if (!model) return;
    let cancelled = false;
    fetch(`/api/models/${model.id}/schema`)
      .then((r) => r.json())
      .then((data: ModelSchemaInfo) => {
        if (!cancelled) setSchema(data);
      })
      .catch(() => {
        if (!cancelled) setSchema(null);
      });
    return () => {
      cancelled = true;
    };
  }, [model]);

  // Real max reference-image count from the live schema when it's loaded;
  // falls back to the static registry value otherwise (or while loading).
  const maxRefs = schema?.maxReferenceImages ?? model?.maxReferences ?? 0;

  // Style/Character/Location/Element picks add another reference image —
  // the exact same `references` array a plain upload goes into, so nothing
  // downstream (generation payload building) needs to know the difference
  // in terms of what gets sent as images_list. What DOES need to carry the
  // difference is the prompt text sent at generate time — a curated pick's
  // own short prompt_modifier (e.g. a "Style" entry described as "moody
  // editorial noir"), or a generic category-specific phrase for a plain
  // upload — but that's assembled fresh in handleSubmit (buildAnnotatedPrompt)
  // rather than injected into the visible prompt textbox here. Storing
  // `promptModifier` on the reference itself is all this needs to do.
  function handleReferencePick(result: ReferencePickResult) {
    if (result.type === "image") {
      addReference(result.url, result.name, maxRefs || 4, result.category, result.promptModifier);
      // A saved character's own generated shots ride along automatically —
      // addReference already no-ops past maxRefs and dedupes by url, so this
      // just fills in as many extra angles/poses as the model's reference
      // cap still has room for.
      result.extraUrls?.forEach((url, i) => addReference(url, `${result.name} ${i + 2}`, maxRefs || 4, result.category));
    } else {
      setPrompt(prompt.trim() ? `${prompt.trim()}, ${result.text}` : result.text);
    }
  }

  // Auto-upgrade to the reference-capable sibling once a reference is
  // attached — but never into a model flagged `unavailable` (e.g. Seedream
  // v4/5.0 Lite Edit while muapi's submission endpoint is down for them),
  // since that would silently route someone into a guaranteed-to-fail
  // generation right as they attach an image.
  useEffect(() => {
    if (!model) return;
    if (references.length > 0 && model.maxReferences === 0) {
      const counterpart = EDIT_COUNTERPART[model.id];
      const target = counterpart && models.find((m) => m.id === counterpart);
      if (target && !target.unavailable) setModelId(counterpart);
    }
  }, [references.length, model, models, setModelId]);

  async function uploadPastedImage(file: File) {
    if (references.length >= (maxRefs || 4)) return;
    try {
      const { url } = await uploadReferenceFile(file);
      // Auto-name as "Image N" (not the raw filename) so it reads well when
      // @-tagged in the prompt — the user can still rename it in the tray.
      addReference(url, undefined, maxRefs || 4);
      setError(null);
    } catch (err) {
      // This used to fail completely silently on e.g. an oversized image
      // (muapi's API caps reference images at 25MB) — the paste/drop/
      // attach just did nothing with no indication why. Now the real
      // error (size, type, auth, network) surfaces here.
      setError(err instanceof Error ? err.message : "Failed to upload image — check your connection and try again");
    }
  }

  async function handleAttachFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttaching(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        await uploadPastedImage(file);
      }
    } finally {
      setAttaching(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) uploadPastedImage(file);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    files.forEach(uploadPastedImage);
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear once the pointer actually leaves the drop zone — dragging
    // over a child element (textarea, buttons, etc) also fires leave/enter
    // on the parent, which would otherwise flicker the highlight off.
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setPrompt(value);

    const cursor = e.target.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([\w-]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function handleMentionSelect(item: MentionItem) {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? prompt.length;
    const uptoCursor = prompt.slice(0, cursor);

    // If this is already one of the current composer references (tagged
    // from "Your references"), don't add a duplicate — just insert its
    // existing name. Otherwise attach it fresh: a plain gallery pick always
    // auto-names "Image N" (never its own title/prompt-derived label), but a
    // saved character (useLabelAsName) keeps its real name so "@Alex" reads
    // as "Alex" in the reference tray instead of a generic index.
    const existing = references.find((r) => r.url === item.url);
    const mentionName =
      existing?.name ??
      addReference(item.url, item.useLabelAsName ? item.label : undefined, maxRefs || 4)?.name ??
      item.label;

    // A saved character's shots + poster ride along automatically — see
    // MentionPopover's characterRefs and ReferencePicker's own extraUrls,
    // same mechanism. Skipped when the primary was already attached (existing),
    // since the extras would presumably already be attached too from that
    // earlier pick.
    if (!existing) {
      item.extraUrls?.forEach((url, i) => addReference(url, `${mentionName} ${i + 2}`, maxRefs || 4, "character"));
    }

    const replaced = uptoCursor.replace(/@([\w-]*)$/, `@${mentionName} `);
    const newValue = replaced + prompt.slice(cursor);
    setPrompt(newValue);
    setMentionQuery(null);
    requestAnimationFrame(() => el.focus());
  }

  async function handleSubmit() {
    if (!model || isSubmitting) return;
    const hasPresetPrompt = !!activePreset?.prompt?.trim();
    if (!prompt.trim() && !hasPresetPrompt && references.length === 0 && !startFrame && !videoReference) return;
    setError(null);
    setSubmitting(true);
    try {
      // A selected preset's own baked-in instruction always leads, with
      // whatever the user typed in the (otherwise empty) prompt box appended
      // as extra detail — see mergePresetPrompt. Reassembled fresh at submit
      // time, same reasoning as buildAnnotatedPrompt just below.
      const basePrompt = mergePresetPrompt(activePreset?.prompt, prompt);
      const annotatedPrompt = buildAnnotatedPrompt(basePrompt, references);
      const res = await fetch(`/api/generate/${category}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: transformPrompt ? transformPrompt(annotatedPrompt) : annotatedPrompt,
          references: references.map((r) => r.url),
          startFrameUrl: startFrame?.url ?? null,
          endFrameUrl: endFrame?.url ?? null,
          videoUrl: videoReference?.url ?? null,
          settings,
          projectId,
          toolId: toolId ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      // Deliberately not clearing prompt/references here — keeping them in
      // the box lets the user regenerate the same setup or tweak it (e.g.
      // swap model) without retyping everything.
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const isSidebar = variant === "sidebar";
  const mentionLabels = references.map((r) => r.name);

  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-4 text-center">
        <div className="text-sm font-medium">No models available yet</div>
        <p className="mt-1 text-xs text-muted">
          This category is wired end-to-end — as soon as a model is added to the registry
          (src/lib/models.ts) it appears here automatically.
        </p>
      </div>
    );
  }

  const costLine = model && (
    <span
      className="text-[11px] text-muted whitespace-nowrap"
      title="Approximate cost — muapi's actual usage-based pricing may vary slightly"
    >
      ~{formatCostUSD(estimatedCostUSD)} · {formatCostINR(estimatedCostUSD)}
    </span>
  );

  const attachButton = (
    <>
      <button
        type="button"
        onClick={() => attachInputRef.current?.click()}
        disabled={attaching}
        title="Attach a reference image"
        className="icon-btn-round shrink-0 disabled:opacity-50"
      >
        {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </button>
      <input
        ref={attachInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleAttachFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  const promptEditorButton = (
    <button
      type="button"
      onClick={() => setPromptEditorOpen(true)}
      title="Prompt editor (⌘E)"
      className="icon-btn-round shrink-0 !h-7 !w-7"
    >
      <SquarePen className="h-3.5 w-3.5" />
    </button>
  );

  const promptEditorModal = promptEditorOpen && (
    <PromptEditorModal
      category={category}
      initialPrompt={prompt}
      referenceUrls={references.map((r) => r.url)}
      onApply={setPrompt}
      onClose={() => setPromptEditorOpen(false)}
    />
  );

  const referencePickerModal = referencePickerCategory && (
    <ReferencePicker
      initialCategory={referencePickerCategory}
      onApply={handleReferencePick}
      onClose={() => setReferencePickerCategory(null)}
    />
  );

  const generateButton = isSidebar ? (
    <button
      onClick={handleSubmit}
      disabled={isSubmitting || !model}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-40 hover:bg-accent-2 transition-colors w-full py-2.5"
    >
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      {isSubmitting ? "Generating…" : "Generate"}
      {model && !isSubmitting && (
        <span className="text-xs font-normal opacity-80">
          · {formatCostUSD(estimatedCostUSD)} · {formatCostINR(estimatedCostUSD)}
        </span>
      )}
    </button>
  ) : (
    <button
      onClick={handleSubmit}
      disabled={isSubmitting || !model}
      className="flex h-16 shrink-0 items-center justify-center gap-1.5 self-center rounded-2xl bg-accent px-6 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
    >
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GenerateIcon className="h-4 w-4" />}
      {isSubmitting ? "Generating…" : "Generate"}
    </button>
  );

  if (isSidebar) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl transition-colors",
          isDragging && "outline-dashed outline-2 outline-accent bg-accent/5"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="panel-label">Model</div>
        {model && <ModelSelector models={models} selectedId={model.id} onSelect={setModelId} direction="down" />}
        {activePreset && <ActivePresetCard preset={activePreset} onClear={() => setActivePreset(null)} />}
        {/* Audio (t2a) models take no image input at all — showing an empty
            "add image" tray here was confusing on the Audio studio. */}
        {model?.mode !== "t2a" && (
          <>
            <div className="panel-label">References</div>
            {model?.supportsStartEndFrame ? (
              <FrameSlots />
            ) : model ? (
              // Always show the attach tray — even for a currently-selected
              // text-only model — so there's a visible "add image" affordance
              // by default instead of only appearing after pasting one (which
              // used to be the only way in, since this was gated on the
              // selected model's static maxReferences being > 0). Attaching an
              // image here still auto-upgrades to the model's reference-capable
              // sibling via the effect above. Style/Character sit as the first
              // two tiles in the row (same size as the "+" upload tile) and
              // open the full Reference Library instead of a plain upload —
              // see handleReferencePick for what a pick actually does.
              <ReferenceTray
                max={Math.max(maxRefs || 0, references.length, 4)}
                imageCategories={REFERENCE_IMAGE_CATEGORIES}
                tagCategories={REFERENCE_TAG_CATEGORIES}
                onOpenCategory={(id) => setReferencePickerCategory(id as RefCategory)}
              />
            ) : null}
            {/* Optional secondary video slot — only for i2v/omni models whose
                live schema actually exposes one (e.g. an image reference +
                motion/scene video character-replace workflow). Lives right
                in this same reference area instead of a separate tab. */}
            {!model?.supportsStartEndFrame && schema?.videoReferenceField && (
              <VideoReferenceSlot
                video={videoReference}
                uploading={videoRefUploading}
                onUpload={handleVideoRefUpload}
                onClear={() => setVideoReference(null)}
              />
            )}
          </>
        )}

        <div className="flex items-center justify-between">
          <div className="panel-label">Prompt</div>
          {promptEditorButton}
        </div>
        <div className="relative rounded-xl border border-border-subtle bg-surface-2 px-1 pb-5 focus-within:border-accent/60 transition-colors">
          <MentionHighlightTextarea
            ref={textareaRef}
            value={prompt}
            mentionLabels={mentionLabels}
            onChange={handleChange}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMentionQuery(null);
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              placeholder ??
              (activePreset
                ? `Add any extra detail "${activePreset.title}" might need (optional)…`
                : category === "audio"
                  ? "Describe the song or sound you want — genre, mood, instruments, tempo…"
                  : "Describe what to generate — paste an image to use as a reference, or type @ to tag one from your gallery…")
            }
            rows={4}
            // max-h + overflow-y-auto caps how tall this can grow before it
            // falls back to an internal scrollbar — matching the bottom
            // composer variant just below (which already had this) and
            // Higgsfield's own fixed-size-with-scroller prompt box. Without
            // it, MentionHighlightTextarea's auto-grow effect had nothing to
            // clamp against and just kept inflating with a long prompt,
            // pushing the sticky Generate button down and, worse, letting
            // the box's own content visibly spill past its own border.
            className="w-full resize-none text-sm placeholder:text-muted outline-none px-1 py-1.5 max-h-56 overflow-y-auto"
          />
          {mentionQuery !== null && (
            <MentionPopover
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={() => setMentionQuery(null)}
              direction="down"
            />
          )}
          <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] tabular-nums text-muted">
            {prompt.length}/2000
          </span>
        </div>

        {/* Suno-style custom lyrics — only shown once the live schema
            confirms this model actually has a lyrics field (see
            LYRICS_CANDIDATES in the schema route); left blank lets the
            model write its own. Multi-line, so it gets its own block
            rather than squeezing into SettingsBar's pill row. */}
        {model?.mode === "t2a" && schema?.lyricsField && (
          <>
            <div className="panel-label">Lyrics (optional)</div>
            <textarea
              value={settings.lyrics ?? ""}
              onChange={(e) => updateSettings({ lyrics: e.target.value })}
              placeholder="Write your own lyrics, or leave blank to let the model write them…"
              rows={4}
              className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm placeholder:text-muted outline-none focus-within:border-accent/60"
            />
          </>
        )}

        <div className="panel-label">Settings</div>
        {model && <SettingsBar model={model} schema={schema} direction="down" />}
        {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
        {/* Sticky footer keeps Generate visible while the panel scrolls.
            Background is fully opaque (not bg-surface/95) so prompt text
            scrolling underneath can't faintly bleed through around the
            button. */}
        <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-1 border-t border-border-subtle/60 bg-surface px-3 py-3">
          {generateButton}
        </div>
        {promptEditorModal}
        {referencePickerModal}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface px-3 py-2.5 transition-colors",
        isDragging && "outline-dashed outline-2 outline-accent bg-accent/5"
      )}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {activePreset && (
        <div className="mb-2">
          <ActivePresetCard preset={activePreset} onClear={() => setActivePreset(null)} />
        </div>
      )}
      {model?.supportsStartEndFrame ? (
          <div className="mb-2">
            <FrameSlots />
          </div>
        ) : references.length > 0 ? (
          <div className="mb-2">
            <ReferenceTray max={Math.max(maxRefs || 0, references.length, 4)} />
          </div>
        ) : null}

        {!model?.supportsStartEndFrame && schema?.videoReferenceField && (
          <div className="mb-2 max-w-xs">
            <VideoReferenceSlot
              video={videoReference}
              uploading={videoRefUploading}
              onUpload={handleVideoRefUpload}
              onClear={() => setVideoReference(null)}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {attachButton}
          <div className="relative flex-1 min-w-0">
            <MentionHighlightTextarea
              ref={textareaRef}
              value={prompt}
              mentionLabels={mentionLabels}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMentionQuery(null);
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                placeholder ??
                (activePreset
                  ? `Add any extra detail "${activePreset.title}" might need (optional)…`
                  : category === "3d"
                    ? "Describe the 3D model you want, or paste/attach a reference image…"
                    : category === "audio"
                      ? "Describe the song or sound you want — genre, mood, instruments, tempo…"
                      : "Describe what to generate, paste an image, or type @ to tag one from your gallery…")
              }
              rows={1}
              className="w-full resize-none text-sm placeholder:text-muted outline-none py-1 leading-5 max-h-48 overflow-y-auto"
            />
            {mentionQuery !== null && (
              <MentionPopover
                query={mentionQuery}
                onSelect={handleMentionSelect}
                onClose={() => setMentionQuery(null)}
              />
            )}
          </div>
          {promptEditorButton}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 pl-10">
          <div className="flex items-center gap-2 flex-wrap">
            {model && <ModelSelector models={models} selectedId={model.id} onSelect={setModelId} />}
            {model && <SettingsBar model={model} schema={schema} />}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline">{costLine}</span>
            {generateButton}
          </div>
        </div>

        {error && <div className="pt-1.5 pl-10 text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
        {promptEditorModal}
        {referencePickerModal}
    </div>
  );
}
