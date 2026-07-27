/**
 * Selectable image-generation "families" for the Thumbnail Generator tool.
 * Each family maps to two real models in src/lib/models.ts: a plain
 * text-to-image variant (used when no slot has an uploaded photo) and a
 * reference-guided edit variant (used the moment at least one image slot is
 * filled) — the user just picks the family by name, the actual t2i/i2i
 * switch happens server-side in /api/thumbnail/generate based on whether
 * there's anything to reference.
 *
 * Deliberately excludes Seedream v4 Edit — its real muapi submit endpoint
 * 404s despite a valid schema (see the doc comment on that model in
 * models.ts), so it's left out here rather than offering a family that's
 * confirmed broken on the edit path this tool actually needs.
 */
export interface ThumbnailModelFamily {
  id: string;
  label: string;
  tagline: string;
  t2iModelId: string;
  editModelId: string;
}

export const THUMBNAIL_MODEL_FAMILIES: ThumbnailModelFamily[] = [
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    tagline: "Fast, strong default",
    t2iModelId: "nano-banana-2",
    editModelId: "nano-banana-2-edit",
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    tagline: "High-fidelity 4K, best likeness/consistency",
    t2iModelId: "nano-banana-pro",
    editModelId: "nano-banana-pro-edit",
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    tagline: "OpenAI's image model",
    t2iModelId: "gpt-image-2",
    editModelId: "gpt-image-2-edit",
  },
  {
    id: "flux-2-klein-9b",
    label: "Flux 2 Klein 9B",
    tagline: "Cheap & fast",
    t2iModelId: "flux-2-dev",
    editModelId: "flux-2-klein-9b-turbo-edit",
  },
];

export const DEFAULT_THUMBNAIL_MODEL_FAMILY = "nano-banana-pro";

export function getThumbnailModelFamily(id: string | null | undefined): ThumbnailModelFamily {
  return (
    THUMBNAIL_MODEL_FAMILIES.find((f) => f.id === id) ??
    THUMBNAIL_MODEL_FAMILIES.find((f) => f.id === DEFAULT_THUMBNAIL_MODEL_FAMILY)!
  );
}
