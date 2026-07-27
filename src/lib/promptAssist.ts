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

import { generateText, GeminiError } from "@/lib/gemini";
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
