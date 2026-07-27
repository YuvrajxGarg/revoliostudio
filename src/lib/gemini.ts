/**
 * Server-side client for Pilot's two LLM-backed features: Assistant mode's
 * plain conversational replies (`generateText`) and Autopilot mode's
 * planning step — turning a brief or a follow-up into a structured,
 * validated multi-step generation plan (`generateJson`).
 *
 * Routed through muapi.ai's own unified LLM endpoint group (`POST
 * /{model-slug}`, same submit-then-poll pattern as every image/video model
 * this codebase already calls via muapi.ts) rather than hitting each
 * provider's API directly — Revolio already has a MUAPI_API_KEY and billing
 * relationship, so this avoids a separate API key/vendor account per model.
 * Which model slug is used per call is the caller's choice — see
 * lib/llmModels.ts for the full selectable catalog (25 models, real muapi
 * pricing) exposed in Pilot's model picker.
 *
 * Trade-off worth knowing (relevant to `generateJson` specifically): muapi's
 * LLM endpoints take only prompt/image_url/system_prompt — no native
 * JSON-schema-enforced output mode (unlike calling a provider's own API
 * directly, which sometimes supports one). So the schema is spelled out in
 * the system prompt and the model is instructed to return raw JSON only,
 * then the response is parsed here. `planBrief` in orchestrator.ts already
 * treats whatever comes back defensively (every step is validated against
 * the real model registry and dropped if it doesn't check out), so a
 * malformed response fails safe into a PlanningError rather than ever
 * reaching a real generate call.
 */

import { submitJob, getResult, MuapiError } from "@/lib/muapi";

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 45_000;

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip a ```json ... ``` (or plain ```) fence if the model wrapped its output in one, despite being told not to. Not anchored to the full string — a conversational/reasoning model will sometimes add a line of preamble before the fence despite instructions not to, and the fence itself is still the part worth extracting. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Best-effort recovery for a model that ignored "raw JSON only" and added
 * commentary before/after the actual payload (seen more often from
 * conversational/reasoning models like Claude than fast completion models
 * like Gemini Flash — the fence-stripping above alone doesn't help when
 * there's no fence at all, just a sentence like "Here's the breakdown:"
 * followed by the object). Tries a straightforward parse first; if that
 * fails, falls back to the outermost {...} span in the text, which recovers
 * cleanly from leading/trailing prose without needing a fence.
 */
function extractJsonPayload(text: string): string {
  const candidate = stripCodeFence(text);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) return candidate.slice(start, end + 1);
    return candidate;
  }
}

/**
 * Shared submit-then-poll core used by both `generateText` and
 * `generateJson` below — submits one prompt/system_prompt call to a muapi
 * LLM endpoint and waits for its raw text output. Callers decide what to do
 * with that text (return it as-is for a chat reply, or parse it as JSON for
 * a plan).
 */
async function runMuapiLlm(params: {
  model: string;
  prompt: string;
  systemPrompt: string;
  imageUrl?: string | null;
}): Promise<string> {
  let submitted;
  try {
    submitted = await submitJob(params.model, {
      prompt: params.prompt,
      system_prompt: params.systemPrompt,
      ...(params.imageUrl ? { image_url: params.imageUrl } : {}),
    });
  } catch (err) {
    const message = err instanceof MuapiError ? err.message : "Failed to submit the request";
    throw new GeminiError(message, err instanceof MuapiError ? err.status : 502);
  }
  const requestId = (submitted.request_id ?? submitted.id) as string | undefined;
  if (!requestId) throw new GeminiError("muapi didn't return a request id.", 502);

  const deadline = Date.now() + MAX_WAIT_MS;
  let raw: string | undefined;

  while (Date.now() < deadline) {
    let result;
    try {
      result = await getResult(requestId);
    } catch (err) {
      const message = err instanceof MuapiError ? err.message : "Failed to poll the request";
      throw new GeminiError(message, err instanceof MuapiError ? err.status : 502);
    }

    if (result.status === "completed") {
      raw = Array.isArray(result.outputs)
        ? (result.outputs[0] as string | undefined)
        : typeof result.output === "string"
          ? result.output
          : Array.isArray(result.output)
            ? (result.output[0] as string | undefined)
            : undefined;
      break;
    }
    if (result.status === "failed" || result.status === "cancelled") {
      throw new GeminiError(result.error || "Request failed on muapi.", 502);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (raw === undefined) {
    throw new GeminiError("Timed out waiting for the request to complete.", 504);
  }
  if (!raw.trim()) {
    throw new GeminiError("The model returned no content — it may have been blocked by safety filters.", 502);
  }
  return raw;
}

/**
 * Plain conversational completion — Assistant mode's chat replies. Returns
 * the model's raw text, trimmed, no JSON parsing involved.
 */
export async function generateText(params: {
  /** muapi LLM endpoint slug — see lib/llmModels.ts. */
  model: string;
  systemInstruction: string;
  prompt: string;
  imageUrl?: string | null;
}): Promise<string> {
  const raw = await runMuapiLlm({
    model: params.model,
    prompt: params.prompt,
    systemPrompt: params.systemInstruction,
    imageUrl: params.imageUrl,
  });
  return raw.trim();
}

const DESCRIBE_IMAGE_SYSTEM_PROMPT =
  "You caption a single reference image for another AI planner that can't see it directly. In under 15 words, describe what the image actually shows — the subject (person/character/object), notable appearance details, and setting if relevant. Plain description only, no preamble, no quotes, no trailing period.";

/**
 * Captions a single reference image via a quick vision call — used to give
 * Pilot's planner real grounding for every attached image, not just the
 * first one. muapi's LLM endpoints only accept ONE `image_url` per call (see
 * generateJson's doc comment), so when a brief has multiple @-referenced
 * images, only image 1 is ever visually seen by the main planning call;
 * everything else is just a bare URL in the text prompt unless it's tagged
 * this way first. Best-effort: a caption failure shouldn't block planning,
 * so callers should catch and fall back to an untagged reference.
 */
export async function describeImage(params: { model: string; imageUrl: string }): Promise<string> {
  const raw = await runMuapiLlm({
    model: params.model,
    prompt: "Describe this image.",
    systemPrompt: DESCRIBE_IMAGE_SYSTEM_PROMPT,
    imageUrl: params.imageUrl,
  });
  return raw.trim().replace(/^["']|["']$/g, "");
}

const CHAT_TITLE_SYSTEM_PROMPT =
  "You name chat threads for an AI creative tool. Given the user's opening message, reply with ONLY a short, punchy name for this chat — exactly 2 or 3 words, Title Case, no punctuation, no quotes, no trailing period, no preamble like \"Title:\". Summarize what they're actually asking for (e.g. \"Coffee Ad Video\", \"Fantasy Portrait\", \"Sneaker Rotation Clip\"), not generic filler like \"New Chat\" or \"User Request\".";

/**
 * Names a Pilot thread — called once, right when a thread is created (see
 * /api/orchestrator/plan/route.ts), from the opening brief. Best-effort:
 * callers should catch a failure and fall back to showing the raw brief in
 * the Chats rail instead (same as before this existed), not block thread
 * creation on it.
 */
export async function generateChatTitle(params: { model: string; brief: string }): Promise<string> {
  const raw = await runMuapiLlm({
    model: params.model,
    prompt: params.brief,
    systemPrompt: CHAT_TITLE_SYSTEM_PROMPT,
  });
  // Models occasionally ignore "no quotes/no trailing period" — strip
  // defensively rather than showing an oddly-punctuated thread name.
  return raw
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

/**
 * Ask an LLM (via muapi) to return JSON matching `responseSchema`, given a
 * system instruction + user prompt. Throws GeminiError on any submit/poll
 * failure, a timeout, or unparseable output.
 */
export async function generateJson<T>(params: {
  /** muapi LLM endpoint slug — see lib/llmModels.ts for the selectable set. */
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  /** Optional single image for multimodal context — muapi's LLM endpoints accept one `image_url`, not an array, so when a brief has multiple @-referenced images only the first is passed here for visual grounding; all of them are still listed by URL/label in the text prompt so the plan itself can use every one. */
  imageUrl?: string | null;
}): Promise<T> {
  const systemPrompt = `${params.systemInstruction}\n\nRespond with ONLY raw JSON matching this exact schema — no markdown code fences, no commentary, no text before or after the JSON:\n${JSON.stringify(
    params.responseSchema
  )}`;

  const raw = await runMuapiLlm({
    model: params.model,
    prompt: params.prompt,
    systemPrompt,
    imageUrl: params.imageUrl,
  });

  try {
    return JSON.parse(extractJsonPayload(raw)) as T;
  } catch {
    // Log the real payload server-side (Vercel runtime logs) — previously
    // this failure only ever reached the client as a bare "wasn't valid
    // JSON" message with nothing to diagnose from, which made a truncated
    // or preamble-wrapped response indistinguishable from a genuinely
    // malformed one.
    console.error(`[generateJson] model=${params.model} returned unparseable output (first 500 chars): ${raw.slice(0, 500)}`);
    throw new GeminiError("The model's response wasn't valid JSON.", 502);
  }
}
