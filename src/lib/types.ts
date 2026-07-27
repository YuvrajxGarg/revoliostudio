export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  user_id: string;
  category: "image" | "video" | "3d" | "audio";
  mode: string;
  model_id: string;
  model_label: string;
  endpoint: string;
  prompt: string;
  reference_urls: string[];
  start_frame_url: string | null;
  end_frame_url: string | null;
  settings: Record<string, unknown>;
  status: GenerationStatus;
  request_id: string | null;
  output_urls: string[];
  thumbnail_url: string | null;
  error: string | null;
  seq_number: number | null;
  cost_usd: number | null;
  project_id?: string | null;
  /** Which config-driven tool studio (see src/lib/toolStudios.ts ids) created this row — null for the plain Image/Video/Audio/3D Generator. Used to keep each tool's gallery scoped to its own output instead of every surface that happens to share a model. */
  tool_id?: string | null;
  /** Soft-delete marker — set when moved to Trash, cleared on restore. Rows with this set are excluded from every normal gallery query (see useGenerations' `trashed` filter). */
  deleted_at?: string | null;
  /** Starred by the user — powers the Projects page's Favorites view. */
  is_favorite?: boolean;
  /** Opt-in publish to the public Community/Explore feed (0027 migration). */
  is_public?: boolean;
  /** When it was published — stable sort key for the Explore feed. */
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Only present on items fetched via /api/shares (the Gallery's "Shared"
   * tab) — who shared this with the current user, and the share row's own
   * id (used to unshare/remove it from view). */
  share_id?: string;
  shared_by?: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  /** Reference Library category ("style"/"character"/"location"/"element") this came from — undefined for a plain drag/drop/file upload not tied to any category. Drives ReferenceTray's per-category slot grouping. */
  category?: string;
  /**
   * A curated pick's admin-authored description (e.g. "moody editorial
   * noir"), if this reference came from one. Stored on the reference itself
   * — rather than being injected into the prompt textbox at pick-time —
   * so the final generate-time prompt can be assembled fresh from whatever
   * order/set of references is actually attached when the user hits
   * Generate, instead of baking in stale text the moment it's picked.
   * See buildReferenceModifier() in PromptComposer.tsx.
   */
  promptModifier?: string;
}
