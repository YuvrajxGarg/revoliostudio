import {
  EMOTION_DESCRIPTIONS,
  RIM_LIGHT_COLORS,
  SAFE_ZONE_BY_ASPECT,
  type EmotionPresetId,
} from "@/lib/thumbnailPresets";

export interface ThumbnailCharacterInput {
  emotionPresetId: EmotionPresetId;
  /** Used when emotionPresetId === "other" (or as a fallback if a preset id somehow doesn't resolve). */
  emotionCustom?: string;
}

/** A scene category's own uploaded reference image (e.g. a real product
 * photo for "Key elements", a real photo of the actual location) — a
 * second, separate channel from character face photos. */
export interface SceneImageRef {
  categoryLabel: string;
  description: string;
}

export interface ThumbnailPromptInput {
  frameLayout: "single" | "split";
  aspectRatio: string;
  characters: ThumbnailCharacterInput[];
  /** Already resolved to only the ones that actually made it into the
   * attached-images list (see resolveThumbnailReferences), in attach order. */
  sceneImageRefs: SceneImageRef[];
  subjectActionPose: string;
  keyElements?: string;
  location: string;
  composition?: string;
  backgroundTreatment?: string;
  rimLightColorId: string;
  /** Non-empty string bakes that exact text in; empty/undefined = no text. */
  bakedText?: string | null;
  /**
   * True when the original reference thumbnail is ALSO attached as an image
   * input — always the LAST attached image, after every character face
   * photo and every scene element image. It's a loose layout/composition/
   * mood guide only, never one of the labeled reference photos above — the
   * prompt calls this out explicitly so the image model doesn't treat it as
   * another face/element to lock onto.
   */
  hasLayoutReference?: boolean;
}

function emotionDescription(c: ThumbnailCharacterInput): string {
  if (c.emotionPresetId !== "other") return EMOTION_DESCRIPTIONS[c.emotionPresetId];
  return c.emotionCustom?.trim() || "a natural, engaged expression";
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
function ordinal(position: number): string {
  return ORDINALS[position - 1] ?? `${position}th`;
}

/**
 * Deterministic (no LLM call) prompt template — intentionally NOT assembled
 * by an LLM. The structure (IDENTITY LOCK per character, ELEMENT REFERENCE
 * per scene image, SAFE ZONE, standardized LIGHTING/GRADE) needs to be
 * identical and reliable every single time; a text-generation step in the
 * loop only introduces a chance of dropping/reordering/garbling that
 * structure for no real benefit, since everything genuinely variable (the
 * scene category text, emotions, colors) is already collected directly from
 * the user/analysis. Exported so both the server route and the client's
 * live prompt preview build the exact same string from the exact same
 * function.
 */
export function buildThumbnailPrompt(input: ThumbnailPromptInput): string {
  const rim = RIM_LIGHT_COLORS.find((r) => r.id === input.rimLightColorId) ?? RIM_LIGHT_COLORS[0];
  const n = input.characters.length;
  const plural = n > 1;
  const lines: string[] = [];

  lines.push(
    input.frameLayout === "split"
      ? `Cinematic photoreal composite still, ${input.aspectRatio}, a clean split-screen layout dividing the frame into balanced panels for the subjects/moments described below — a crisp dividing line, each panel distinctly separated but color-graded into one cohesive image.`
      : `Cinematic photoreal composite still, ${input.aspectRatio}, single unified frame — no split-screen, no diagonal divide, everything blends smoothly and organically across the same continuous shot.`
  );

  const sceneBriefBits = [input.subjectActionPose.trim()];
  if (input.keyElements?.trim()) sceneBriefBits.push(`featuring ${input.keyElements.trim()}`);
  lines.push(`SCENE BRIEF (must be depicted exactly): ${sceneBriefBits.join(", ")}.`);

  lines.push(
    input.bakedText?.trim()
      ? `Bake this exact bold, high-contrast title text into the image, short and legible: "${input.bakedText.trim()}".`
      : `No text, no readable UI labels, no watermark.`
  );

  if (n > 0) {
    lines.push(`SUBJECTS (${n} ${plural ? "people" : "person"} in the frame):`);
    input.characters.forEach((c, i) => {
      lines.push(
        `CHARACTER ${i + 1}: the person from attached face reference #${i + 1} — IDENTITY LOCK: reproduce this exact person with a photographic identity match — same bone structure, eye shape, nose, lips, jawline, skin tone, hairline and hair texture as the reference photo. Do NOT beautify, do NOT average with other faces, do NOT restyle the face; it must be recognizably the same person at a glance. Expression: ${emotionDescription(c)}.`
      );
    });
  }
  lines.push(`Staging: ${input.subjectActionPose.trim()}.`);
  if (n > 0) lines.push(`All faces crisply sharp as the anchors of the shot.`);

  if (input.keyElements?.trim()) lines.push(`KEY ELEMENTS: ${input.keyElements.trim()}`);
  lines.push(`LOCATION: ${input.location.trim()}`);
  if (input.composition?.trim()) lines.push(`COMPOSITION: ${input.composition.trim()}`);

  // Each attached scene-element image (a real photo the user uploaded for a
  // specific category — a product shot, a real location photo, etc.) gets
  // its own explicit, positionally-anchored instruction, same reasoning as
  // character IDENTITY LOCK: a purely descriptive reference with no ordinal
  // anchor is exactly what causes an image model to misassign attached
  // photos.
  input.sceneImageRefs.forEach((ref, i) => {
    const position = n + i + 1;
    lines.push(
      `ELEMENT REFERENCE (attached ${ordinal(position)} image): this is the real ${ref.categoryLabel.toLowerCase()} to depict — ${ref.description.trim() || "reproduce it faithfully, exactly as shown"}. Do not reinvent or restyle it.`
    );
  });

  const safeZone = SAFE_ZONE_BY_ASPECT[input.aspectRatio];
  if (safeZone && n > 0) {
    lines.push(
      `SAFE ZONE (critical): compose so that every face and the key focal action sit fully inside the CENTERED ${safeZone} crop of the frame — if the sides of the ${input.aspectRatio} canvas were trimmed to a centered ${safeZone} window, nothing important would be cut off. Edges outside that window carry only extendable background, atmosphere and secondary elements.`
    );
  }

  if (input.backgroundTreatment?.trim()) {
    lines.push(`BACKGROUND TREATMENT (blended, not divided): ${input.backgroundTreatment.trim()}`);
  }

  lines.push(
    `LIGHTING: signature YouTube-thumbnail lighting rig on the subject${plural ? "s" : ""} — a strong KEY LIGHT sculpting the face with crisp highlights and controlled falloff, a soft dreamy DREAM LIGHT fill lifting the shadows with a subtle cinematic glow, and a defined BACK LIGHT + HAIR LIGHT tracing a clean bright rim in ${rim.promptPhrase} along the hair, shoulders and silhouette, separating the subject${plural ? "s" : ""} sharply from the background.`
  );

  lines.push(
    `GRADE: refined cinematic color grade, controlled contrast, soft natural highlight roll-off, fine subtle grain, poster-clean, restrained, premium, cohesive as one image. ${input.aspectRatio}.`
  );

  if (input.hasLayoutReference) {
    const position = n + input.sceneImageRefs.length + 1;
    lines.push(
      `The ${ordinal(position)} and final attached image is the ORIGINAL REFERENCE THUMBNAIL this composition is based on — use it ONLY as a loose guide for overall layout, framing, and mood. Do NOT copy its exact subjects, faces, or fine details; it is not one of the character/element references above.`
    );
  }

  return lines.join("\n");
}

// ── Reference-image budget resolution ──────────────────────────────────
//
// Every image model family this tool offers caps out at 4 reference images
// (see thumbnailModels.ts / models.ts). Three different channels can supply
// images — character face photos, per-category scene element photos, and
// the original reference thumbnail — which can easily add up to more than
// 4 combined. Rather than silently failing or truncating inconsistently
// between the live prompt preview and the real submission, one shared,
// priority-ordered resolver decides what actually gets attached: character
// identity photos always win (there's no substitute for them), scene
// element photos fill whatever's left in category order, and the loose
// layout-guide reference — the least essential, since its whole purpose is
// non-critical composition inspiration — is first to be dropped if the
// budget runs out.

export interface SceneImageSource {
  categoryLabel: string;
  description: string;
  imageUrl: string;
}

export interface ThumbnailReferenceSource {
  characterPhotoUrls: string[];
  sceneImages: SceneImageSource[];
  layoutReferenceUrl?: string | null;
}

export interface ResolvedThumbnailReferences {
  /** Final, capped, in-attach-order list of image URLs to submit. */
  urls: string[];
  /** Only the scene element refs that actually made the cut, in attach order. */
  sceneImageRefs: SceneImageRef[];
  /** Whether the original reference thumbnail made the cut. */
  hasLayoutReference: boolean;
}

const MAX_THUMBNAIL_REFERENCES = 4;

export function resolveThumbnailReferences(
  source: ThumbnailReferenceSource,
  maxReferences: number = MAX_THUMBNAIL_REFERENCES
): ResolvedThumbnailReferences {
  interface Attached {
    url: string;
    role: "character" | "element" | "layout";
    sceneRef?: SceneImageRef;
  }

  const attached: Attached[] = [
    ...source.characterPhotoUrls.map((url): Attached => ({ url, role: "character" })),
    ...source.sceneImages.map(
      (s): Attached => ({ url: s.imageUrl, role: "element", sceneRef: { categoryLabel: s.categoryLabel, description: s.description } })
    ),
  ];
  if (source.layoutReferenceUrl) attached.push({ url: source.layoutReferenceUrl, role: "layout" });

  const capped = attached.slice(0, Math.max(0, maxReferences));

  return {
    urls: capped.map((a) => a.url),
    sceneImageRefs: capped.filter((a) => a.role === "element").map((a) => a.sceneRef!),
    hasLayoutReference: capped.some((a) => a.role === "layout"),
  };
}
