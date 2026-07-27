import { getExplainerStyle } from "@/lib/explainerPresets";

export interface ExplainerShotPromptInput {
  /** The shot's visual description — from Claude's breakdown, or hand-edited by the user. */
  visual: string;
  /** The shot's on-screen caption/voiceover line — only actually rendered into the frame if bakeCaption is true. */
  caption: string;
  bakeCaption: boolean;
  styleId: string;
  /** Used when styleId === "custom". */
  styleCustom?: string;
  aspectRatio: string;
  /** How many style/design reference images are attached to THIS render call — always the same fixed set across every shot in a storyboard, unlike Thumbnail Generator's per-category images, so no per-shot ordinal bookkeeping is needed. 0 = none attached. */
  styleReferenceCount: number;
}

/**
 * Deterministic (no LLM call) per-shot prompt template — same reasoning as
 * Thumbnail Generator's buildThumbnailPrompt: the structure (style framing,
 * explicit "not photoreal" guard, style-reference instruction, closing
 * cleanliness boilerplate) needs to be identical and reliable every single
 * time, so a text-generation step in the loop would only add a chance of
 * drifting off-style shot to shot. The genuinely variable part (what's
 * actually depicted) already comes straight from Claude's shot breakdown or
 * the user's own edit.
 */
export function buildExplainerShotPrompt(input: ExplainerShotPromptInput): string {
  const style =
    input.styleId === "custom"
      ? { promptPhrase: input.styleCustom?.trim() || "clean modern motion-graphics illustration style" }
      : getExplainerStyle(input.styleId);

  const lines: string[] = [];

  lines.push(
    `Motion-graphics explainer-video still frame, ${input.aspectRatio}, ${style.promptPhrase}. This is a single polished illustrated/motion-graphics frame — NOT a photograph, NOT photoreal, NOT live-action footage.`
  );

  lines.push(`SHOT CONTENT (must be depicted exactly): ${input.visual.trim()}`);

  lines.push(
    input.bakeCaption && input.caption.trim()
      ? `Bake this exact short line of on-screen text into the frame, bold and legible: "${input.caption.trim()}".`
      : `No readable on-screen text, no captions, no watermark, no signature — the visual should read clearly on its own.`
  );

  if (input.styleReferenceCount > 0) {
    lines.push(
      input.styleReferenceCount === 1
        ? `STYLE REFERENCE (the attached reference image): match its visual style, linework, color palette, and overall design language exactly — do NOT copy its specific subject matter, only its look and feel.`
        : `STYLE REFERENCE (the ${input.styleReferenceCount} attached reference images): match their shared visual style, linework, color palette, and overall design language exactly — do NOT copy their specific subject matter, only the look and feel.`
    );
  }

  lines.push(
    `Composition: clean, uncluttered, a single unified frame — no split screen, no collage of unrelated panels, generous breathing room around the main subject so it reads instantly at a glance.`
  );
  lines.push(`Finish: polished and production-ready, as if it were one frame of a professionally animated explainer video.`);

  return lines.join("\n");
}

const MAX_STYLE_REFERENCES = 4;

/**
 * Style/design references are shared across every shot in a storyboard (the
 * whole point is one consistent look) rather than competing per-shot like
 * Thumbnail Generator's character/scene images — so there's nothing to
 * prioritize, just a straight cap at whatever the chosen model actually
 * supports. Exported so the client's live prompt preview and the server's
 * real submission always agree on exactly how many are attached.
 */
export function resolveExplainerStyleReferences(urls: string[], maxReferences: number = MAX_STYLE_REFERENCES): string[] {
  return urls.filter((u) => u.trim()).slice(0, Math.max(0, maxReferences));
}
