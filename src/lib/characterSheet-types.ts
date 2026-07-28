export type CharacterSheetQuality = "compact" | "studio";

export type CharacterSheetSection = "angles" | "poses" | "details" | "expressions" | "lighting";

export type CharacterSheetSlotStatus = "queued" | "processing" | "completed" | "failed";

/** One of the 24 generation slots — mirrors OrchestratorStep's shape closely
 * (index/label/status/generationId/outputUrl/error) but flat, since these
 * aren't a dependency chain, just 24 independent submissions against the
 * same reference image. */
export interface CharacterSheetSlot {
  index: number;
  section: CharacterSheetSection;
  label: string;
  prompt: string;
  status: CharacterSheetSlotStatus;
  generationId?: string | null;
  outputUrl?: string | null;
  error?: string | null;
}

/** Extracted once, by a single vision-LLM call against the uploaded face —
 * see generateCharacterMetadata in lib/characterSheet.ts. */
export interface CharacterMetadata {
  age: string;
  ethnicity: string;
  height: string;
  build: string;
  eyes: string;
  hair: string;
  skinTone: string;
  distinguishingMarks: string;
  style: string;
  /** The reusable "use this in every prompt" description — prepended to
   * every one of the 24 slot prompts so every shot stays textually
   * consistent, not just visually reference-locked. */
  anchorPhrase: string;
}

export type CharacterSheetStatus = "analyzing" | "generating" | "completed" | "failed";

export interface CharacterSheet {
  id: string;
  user_id: string;
  source_face_url: string;
  quality: CharacterSheetQuality;
  /** Which face-consistency model (src/lib/characterSheetModels.ts) ran
   * this sheet's shots — null on rows from before model selection existed. */
  model_id: string | null;
  metadata: CharacterMetadata | null;
  slots: CharacterSheetSlot[];
  status: CharacterSheetStatus;
  total_cost_usd: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
