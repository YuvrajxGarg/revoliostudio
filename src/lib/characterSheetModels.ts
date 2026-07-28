/**
 * Curated subset of Revolio's i2i model registry (src/lib/models.ts) worth
 * offering for a face-consistency sheet — not every i2i "Edit" model is a
 * good fit, so this is a hand-picked shortlist rather than exposing the
 * full ~20-model catalog. Costs are muapi's real per-image price (see
 * src/lib/pricing.ts) — not estimates.
 */
export interface CharacterModelOption {
  /** Must match a real id in src/lib/models.ts. */
  id: string;
  label: string;
  costPerImageUsd: number;
  blurb: string;
}

export const CHARACTER_MODEL_OPTIONS: CharacterModelOption[] = [
  {
    id: "flux-pulid",
    label: "Flux PuLID",
    costPerImageUsd: 0.04,
    blurb: "Purpose-built face-ID lock — the most reliable option for exact likeness.",
  },
  {
    id: "flux-kontext-pro-edit",
    label: "Flux Kontext Pro",
    costPerImageUsd: 0.03,
    blurb: "Fast and cheap, with solid consistency across shots.",
  },
  {
    id: "qwen-edit-plus",
    label: "Qwen Edit Plus",
    costPerImageUsd: 0.03,
    blurb: "Budget option — decent consistency for the price.",
  },
  {
    id: "nano-banana-2-edit",
    label: "Nano Banana 2 Edit",
    costPerImageUsd: 0.06,
    blurb: "Strong identity preservation with richer detail.",
  },
  {
    id: "nano-banana-pro-edit",
    label: "Nano Banana Pro Edit",
    costPerImageUsd: 0.12,
    blurb: "Highest fidelity of the set — best quality, priciest.",
  },
];

export const DEFAULT_CHARACTER_MODEL_ID = "nano-banana-2-edit";

export function getCharacterModelOption(id: string | undefined | null): CharacterModelOption {
  return CHARACTER_MODEL_OPTIONS.find((m) => m.id === id) ?? CHARACTER_MODEL_OPTIONS[0];
}
