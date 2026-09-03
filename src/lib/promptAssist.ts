/**
 * Backs the Magnific-style "Prompt editor" flyout available from the Image,
 * Video, Audio, and 3D composers (PromptComposer.tsx) — an expanded textarea
 * plus an AI side panel that can chat about the prompt, suggest a random
 * one, expand a draft into a fuller prompt, or turn an attached reference
 * image into prompt text.
 *
 * Built on gemini.ts's generateText — the same muapi LLM infra Pilot's
 * Assistant mode already uses — fixed to DEFAULT_LLM_MODEL rather than
 * exposing a model picker in this small panel. It's a cheap/fast model and
 * this feature only ever produces a sentence or two of output, so picking on
 * cost here would be needless UI for negligible savings.
 */

import { generateText, generateJson, GeminiError } from "@/lib/gemini";
import { DEFAULT_LLM_MODEL } from "@/lib/llmModels";
import type { Category } from "@/lib/models";

export class PromptAssistError extends Error {}

const CATEGORY_NOUN: Record<Category, string> = {
  image: "image",
  video: "video",
  audio: "song/audio",
  "3d": "3D model",
};

async function run(fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Something went wrong";
    throw new PromptAssistError(message);
  }
}

/**
 * Open-ended chat about the prompt — "Ask me anything about your prompt".
 * Every assistant reply gets a one-click "Use this" action in the UI, so the
 * system prompt nudges the model to return clean, directly-usable prompt
 * text (no preamble/quotes) whenever the user is asking for a rewrite, and
 * to just reply normally/conversationally otherwise — a plain question like
 * "what makes a good prompt for this?" shouldn't come back formatted as if
 * it were prompt text.
 */
export async function chatAboutPrompt(params: {
  category: Category;
  draft: string;
  history: { role: "user" | "assistant"; text: string }[];
  message: string;
}): Promise<string> {
  const noun = CATEGORY_NOUN[params.category];
  const systemInstruction = `You help write and refine a ${noun} generation prompt inside a "Prompt editor" side panel. The user's current draft prompt (may be empty) and the conversation so far are given below. When they ask you to write, rewrite, expand, or improve the prompt, reply with ONLY the new prompt text itself — no preamble like "Here's an improved version:", no surrounding quotes, no markdown — since your whole reply can be inserted directly with one click. For general questions, brainstorming, or feedback, just reply normally and conversationally instead.`;
  const transcript = params.history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n\n");
  const prompt = `Current draft prompt: ${params.draft.trim() ? `"${params.draft}"` : "(empty)"}\n\n${
    transcript ? `${transcript}\n\n` : ""
  }User: ${params.message}`;
  return run(() => generateText({ model: DEFAULT_LLM_MODEL, systemInstruction, prompt }));
}

/** "Random prompt" — one fresh, ready-to-use example prompt, ignoring any existing draft entirely. */
export async function randomPrompt(category: Category): Promise<string> {
  const noun = CATEGORY_NOUN[category];
  const systemInstruction = `Invent one creative, ready-to-use example prompt for ${noun} generation — vivid and specific (subject, setting, and style/mood as relevant). Reply with ONLY the prompt text, no preamble, no quotes, no trailing period.`;
  return run(() => generateText({ model: DEFAULT_LLM_MODEL, systemInstruction, prompt: "Surprise me." }));
}

/**
 * "Auto prompt" — expands/improves whatever's currently in the draft into a
 * fuller prompt. Falls back to `randomPrompt` when the draft is blank
 * (nothing to expand), same as clicking Random would do.
 */
export async function autoPrompt(category: Category, draft: string): Promise<string> {
  if (!draft.trim()) return randomPrompt(category);
  const noun = CATEGORY_NOUN[category];
  const systemInstruction = `Expand and improve the following draft into a complete, vivid prompt for ${noun} generation. Keep the user's core subject/idea intact — add helpful specificity (composition, lighting, style, mood, etc, as relevant) rather than changing what they actually asked for. Reply with ONLY the improved prompt text, no preamble, no quotes.`;
  return run(() => generateText({ model: DEFAULT_LLM_MODEL, systemInstruction, prompt: draft }));
}

/**
 * "Image to prompt" — describes an attached reference image as ready-to-use
 * prompt text. Distinct from gemini.ts's `describeImage`, which writes a
 * short caption for Pilot's planner (a different audience/purpose) — this
 * one is tuned to read like an actual generation prompt a user would type.
 */
export async function imageToPrompt(category: Category, imageUrl: string): Promise<string> {
  const noun = CATEGORY_NOUN[category];
  const systemInstruction = `Look at this reference image and write it up as a ready-to-use ${noun} generation prompt describing it — subject, composition, style, lighting, and mood, as visible. Reply with ONLY the prompt text, no preamble, no quotes.`;
  return run(() =>
    generateText({ model: DEFAULT_LLM_MODEL, systemInstruction, prompt: "Describe this as a generation prompt.", imageUrl })
  );
}

/** One candidate model the composer can actually switch to — passed in from the client so a suggestion never names a model that isn't selectable in the current studio (respects the composer's own modelFilter). */
export interface VaryCandidateModel {
  id: string;
  label: string;
  provider: string;
}

export interface VariationSuggestion {
  /** A meaningfully reworked prompt — same core subject, different phrasing/detail — so a fresh regeneration actually diverges from the repeated ones. */
  suggestedPrompt: string;
  /** Id of a DIFFERENT model to try (one of the passed candidates), or null when none is a clearly better fit. */
  suggestedModelId: string | null;
  /** One short, friendly sentence explaining why this change should help. */
  reason: string;
}

const VARY_SCHEMA = {
  type: "object",
  properties: {
    suggestedPrompt: { type: "string" },
    suggestedModelId: { type: "string" },
    reason: { type: "string" },
  },
  required: ["suggestedPrompt", "reason"],
};

/**
 * Backs the "you've generated this a few times" nudge (RepeatWarningModal):
 * when a user has fired the same prompt + references at the same model more
 * than twice, we offer a genuinely different thing to try rather than just
 * telling them to change something. Returns a reworked prompt plus, when one
 * of the offered candidate models fits better, its id — so the modal's
 * "Use suggested settings" can swap both in one click.
 *
 * `candidates` is the composer's own selectable model list (already filtered
 * to the current studio), minus the current model, so a suggested model is
 * always one the user can actually pick here.
 */
export async function suggestVariation(params: {
  category: Category;
  draft: string;
  currentModelLabel: string;
  candidates: VaryCandidateModel[];
}): Promise<VariationSuggestion> {
  const noun = CATEGORY_NOUN[params.category];
  const candidateList = params.candidates.length
    ? params.candidates.map((m) => `- ${m.id} — ${m.label} (${m.provider})`).join("\n")
    : "(no alternative models available — leave suggestedModelId empty)";
  const systemInstruction = `The user keeps running the SAME ${noun} generation prompt on the SAME model (${params.currentModelLabel}) and getting repetitive results. Help them break out of it.

Return:
- suggestedPrompt: a reworked version of their prompt that keeps the same core subject/intent but changes the phrasing and adds fresh, specific creative direction (composition, lighting, style, mood, camera, detail) so a new run actually diverges from the previous ones. It must read as a clean, ready-to-use prompt — no preamble, no quotes.
- suggestedModelId: the id of ONE model from the candidate list below that would plausibly give a different or better result, EXACTLY as written. Use an empty string if none is clearly worth switching to. Never invent an id that isn't in the list.
- reason: one short, friendly sentence telling the user why this tweak should help.

Candidate models the user can switch to:
${candidateList}`;
  const draft = params.draft.trim() || "(the user left the prompt empty and relied on references)";
  try {
    const raw = await generateJson<VariationSuggestion & { suggestedModelId?: string }>({
      model: DEFAULT_LLM_MODEL,
      systemInstruction,
      prompt: draft,
      responseSchema: VARY_SCHEMA,
    });
    const validId =
      raw.suggestedModelId && params.candidates.some((m) => m.id === raw.suggestedModelId)
        ? raw.suggestedModelId
        : null;
    return {
      suggestedPrompt: (raw.suggestedPrompt ?? "").trim(),
      suggestedModelId: validId,
      reason: (raw.reason ?? "").trim(),
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Couldn't fetch a suggestion";
    throw new PromptAssistError(message);
  }
}
