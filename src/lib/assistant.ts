/**
 * Pilot's Assistant mode — a plain conversational LLM chat, no planning, no
 * steps, no cost/approval flow (that's Autopilot mode, see orchestrator.ts).
 * Just a friendly, general-purpose assistant for anyone using Revolio
 * Studio, backed by whichever muapi LLM the thread picked.
 */

import { generateText, GeminiError } from "@/lib/gemini";
import { getLlmModel } from "@/lib/llmModels";
import type { OrchestratorMessage } from "@/lib/orchestrator-types";

export class AssistantError extends Error {}

const SYSTEM_INSTRUCTION = `You are Pilot, Revolio Studio's built-in AI assistant. Revolio Studio is a creative app for generating images, video, 3D, and audio with AI. You're having a normal, friendly conversation — you can discuss ideas, brainstorm, explain concepts, give feedback, help plan a creative project, or just chat about anything. You are NOT restricted to only talking about Revolio.

If the user clearly wants you to actually GENERATE or CREATE something (an image, a video, a 3D model, audio) — don't try to describe a step-by-step plan yourself, since you can't execute generations in this mode. Just say so briefly and suggest they switch to Autopilot mode (the toggle above this chat), which can actually plan and run real generations.

Keep replies conversational and reasonably concise unless the user is clearly asking for something long-form.`;

/**
 * Builds a plain-text transcript from prior turns (muapi's LLM endpoints
 * are stateless per call — no multi-turn message array param, just one
 * prompt string — so conversation memory has to be folded into the prompt
 * text itself) and asks the model for its next reply.
 */
export async function chatReply(params: {
  message: string;
  llmModel: string;
  history: OrchestratorMessage[];
  /** Images attached via the @ reference picker on this message, if any — only the first is passed to the model for visual context (see generateText's imageUrl note). */
  referenceUrls?: string[];
}): Promise<string> {
  const transcript = params.history
    .map((m) => `${m.role === "user" ? "User" : "Pilot"}: ${m.text}`)
    .join("\n\n");
  const prompt = transcript ? `${transcript}\n\nUser: ${params.message}` : params.message;

  try {
    return await generateText({
      model: getLlmModel(params.llmModel).id,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      imageUrl: params.referenceUrls?.[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Pilot couldn't reply right now";
    throw new AssistantError(message);
  }
}
