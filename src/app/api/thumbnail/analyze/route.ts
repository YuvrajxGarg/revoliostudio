import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateJson, GeminiError } from "@/lib/gemini";
import { EMOTION_PRESETS, MAX_CHARACTERS, type EmotionPresetId } from "@/lib/thumbnailPresets";

export const runtime = "nodejs";

// Same reasoning as before: a completion-style/reasoning model that's
// actually good at "multimodal analysis" (per its own catalog description)
// rather than the cheap/fast chat default.
const ANALYSIS_LLM_MODEL = "claude-sonnet-5";

const VALID_EMOTION_IDS = EMOTION_PRESETS.map((e) => e.id).filter((id) => id !== "other") as Exclude<
  EmotionPresetId,
  "other"
>[];

export interface ThumbnailAnalysis {
  archetype: string;
  /** 0 (no people) to MAX_CHARACTERS — capped, never invented beyond what's actually visible. */
  peopleCount: number;
  /** Best-guess emotion preset per detected person, left-to-right, length === peopleCount. */
  suggestedEmotions: Exclude<EmotionPresetId, "other">[];
  subjectActionPose: string;
  keyElements: string;
  location: string;
  composition: string;
  backgroundTreatment: string;
}

interface RawAnalysis {
  archetype?: string;
  peopleCount?: number;
  suggestedEmotions?: string[];
  subjectActionPose?: string;
  keyElements?: string;
  location?: string;
  composition?: string;
  backgroundTreatment?: string;
}

const SYSTEM_INSTRUCTION = `You analyze a reference YouTube thumbnail image ONLY to extract a text description of its composition — the image itself is never used further, so describe everything a person would need to recreate a similar look from scratch, with their own people and content.

Return these fields, all as plain text (never markdown, never a list):
- archetype: a short label for this composition style, e.g. "Reaction-face with cash pyramid", "Before/after split", "Big subject, bold text".
- peopleCount: how many distinct people/faces appear in frame, as an integer from 0 to ${MAX_CHARACTERS}. If more than ${MAX_CHARACTERS} genuinely appear, report ${MAX_CHARACTERS} (the tool only supports up to that many).
- suggestedEmotions: an array with exactly "peopleCount" entries, one per person in clear left-to-right order as they appear in the image. Each entry MUST be exactly one of this fixed list: ${VALID_EMOTION_IDS.join(", ")}. Pick whichever single value best matches that person's expression — never invent a new value.
- subjectActionPose: what the main subject(s) are doing and how they're posed/framed (e.g. "leaning toward camera pointing excitedly at something off-frame"). Always required, even with 0 people (describe the main focal action/pose of whatever the focal subject is).
- keyElements: any deliberate focal objects/props in the shot (e.g. "a pyramid of stacked cash", "a glowing trophy") — empty string if there's genuinely no distinct prop/object beyond the subject(s).
- location: the setting/environment (e.g. "a bright rooftop at daylight", "a neon-lit city street at night"). Always required.
- composition: camera angle/framing description (e.g. "medium close-up, subject in the left third, eye-level camera") — empty string only if there's truly nothing distinctive beyond a plain center shot.
- backgroundTreatment: what the background itself looks like, separate from "location" (e.g. "a solid saturated blue studio backdrop with soft light rays") — empty string if it's just an unremarkable plain background.

Be concrete and specific to THIS reference, not generic filler.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    archetype: { type: "string" },
    peopleCount: { type: "number" },
    suggestedEmotions: { type: "array", items: { type: "string", enum: VALID_EMOTION_IDS } },
    subjectActionPose: { type: "string" },
    keyElements: { type: "string" },
    location: { type: "string" },
    composition: { type: "string" },
    backgroundTreatment: { type: "string" },
  },
  required: ["archetype", "peopleCount", "suggestedEmotions", "subjectActionPose", "location"],
};

const DEFAULT_EMOTION: Exclude<EmotionPresetId, "other"> = "charismatic_calm";

function sanitize(raw: RawAnalysis): ThumbnailAnalysis {
  const peopleCount = Math.max(0, Math.min(MAX_CHARACTERS, Math.round(Number(raw.peopleCount) || 0)));

  const emotions = (raw.suggestedEmotions ?? []).filter((e): e is Exclude<EmotionPresetId, "other"> =>
    (VALID_EMOTION_IDS as string[]).includes(e)
  );
  // Pad with a sensible default (never leave a character with no guess at
  // all) or truncate — the client always shows these as editable presets,
  // so a slightly-off guess costs the user one click, not a broken form.
  while (emotions.length < peopleCount) emotions.push(DEFAULT_EMOTION);
  const suggestedEmotions = emotions.slice(0, peopleCount);

  return {
    archetype: raw.archetype?.trim() || "Custom thumbnail",
    peopleCount,
    suggestedEmotions,
    subjectActionPose: raw.subjectActionPose?.trim() || "The main subject reacts directly to camera",
    keyElements: raw.keyElements?.trim() || "",
    location: raw.location?.trim() || "A simple, clean studio background",
    composition: raw.composition?.trim() || "",
    backgroundTreatment: raw.backgroundTreatment?.trim() || "",
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl) return NextResponse.json({ error: "Upload a reference thumbnail first" }, { status: 400 });

  // One retry on a different model before giving up — a single malformed
  // response shouldn't dead-end the tool. gemini-2-5-pro is the fallback: a
  // real multimodal reasoning model, less prone to the conversational
  // preamble that occasionally trips up JSON-only parsing on chat models.
  const attempts = [ANALYSIS_LLM_MODEL, "gemini-2-5-pro"];
  let lastError: unknown;

  for (const model of attempts) {
    try {
      const raw = await generateJson<RawAnalysis>({
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: "Analyze this reference thumbnail and return the fields as JSON.",
        responseSchema: RESPONSE_SCHEMA,
        imageUrl,
      });
      return NextResponse.json(sanitize(raw));
    } catch (err) {
      lastError = err;
    }
  }

  const message = lastError instanceof GeminiError ? lastError.message : "Analysis failed";
  return NextResponse.json({ error: message }, { status: 502 });
}
