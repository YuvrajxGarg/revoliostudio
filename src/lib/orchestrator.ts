/**
 * Autopilot's planning core — turns a plain-language brief ("make a TikTok
 * for my sneakers"), or a follow-up in an ongoing thread ("now make it more
 * colorful"), into a validated, ready-to-run set of new plan steps using
 * Revolio's own model registry. This is the "core orchestrator" slice of
 * what Higgsfield calls Supercomputer: auto model selection, a shown-upfront
 * cost estimate, a real back-and-forth conversation, and a plan that
 * executes through the exact same `/api/generate/[category]` path every
 * composer already uses — no Skills marketplace, memory, scheduling, or
 * external connectors in this pass.
 */

import { MODELS, getModel, type Category, type ModelConfig } from "@/lib/models";
import { estimateCostUSD } from "@/lib/pricing";
import { generateJson, describeImage, GeminiError } from "@/lib/gemini";
import { getLlmModel } from "@/lib/llmModels";
import type { OrchestratorStep } from "@/lib/orchestrator-types";

// Models always worth offering the planner even when not flagged
// `popular`/`recommended` — utility steps (cleanup, upscale, face swap) that
// a real multi-step brief commonly needs but that don't stand alone as a
// "hero" model a user would pick by default.
const UTILITY_MODEL_IDS = [
  "ai-background-remover",
  "topaz-image-upscale",
  "ai-image-upscaler",
  "ai-video-upscaler",
  "ai-video-face-swap",
  "runway-motion-control",
  "wan-animate",
];

function catalogModels(): ModelConfig[] {
  const ids = new Set<string>();
  const list: ModelConfig[] = [];
  for (const m of MODELS) {
    if (m.unavailable) continue;
    if (!(m.popular || m.recommended || UTILITY_MODEL_IDS.includes(m.id))) continue;
    if (ids.has(m.id)) continue;
    ids.add(m.id);
    list.push(m);
  }
  return list;
}

function formatCatalog(models: ModelConfig[]): string {
  return models
    .map((m) => {
      const bits = [`${m.id}`, `${m.category}/${m.mode}`, m.label];
      if (m.tagline) bits.push(`— ${m.tagline}`);
      const extras: string[] = [];
      if (m.maxReferences > 0) extras.push(`takes up to ${m.maxReferences} reference image(s)`);
      if (m.requiresVideoInput) extras.push("takes a video as primary input");
      if (m.aspectRatios?.length) extras.push(`aspect ratios: ${m.aspectRatios.join("/")}`);
      if (m.durations?.length) extras.push(`durations(s): ${m.durations.join("/")}`);
      return extras.length ? `${bits.join(" | ")} (${extras.join("; ")})` : bits.join(" | ");
    })
    .join("\n");
}

// Condensed from muapi.ai's own public, unauthenticated recipe catalog
// (GET https://api.muapi.ai/api/v1/agent-skills, checked 2026-07-16) — real
// step patterns their own agent product uses for common creative briefs.
// Given purely as *shape* inspiration (what step sequence a brief like this
// usually wants), not literal instructions — those recipes chain muapi's own
// internal tool ids directly against muapi's systems, not Revolio's model
// registry/generate pipeline/cost tracking, so they aren't executable here
// as-is. Kept short (not the full 40+ list) to stay out of the way of the
// model catalog, which is what actually has to be followed exactly.
const RECIPE_INSPIRATION = `Common brief patterns and the shape of plan that usually fits (for inspiration only — always still pick real modelIds from the catalog above):
- "product ad" / "commercial" / "cinematic ad" -> generate or use a product photo, then animate it into a short video.
- "logo" / "brand kit" / "branding" -> generate a clean logo/brand image (optionally a couple of variations).
- "instagram post" / "social pack" -> generate one hero image, optionally reframe/crop for a second aspect ratio.
- "storyboard" / "keyframes" -> generate a small sequence of still images, no video.
- "UGC" / "lifestyle" / "influencer" style content -> generate a realistic lifestyle-style photo of the subject/product in context.
- "action figure" / "toy" / "3D" from a photo -> image edit into the target style, then (if truly asked for 3D) a 3D step.
- "multi-angle" / "different angles" -> generate 2-4 image variations describing different camera angles in each prompt.
- "youtube thumbnail" / "blog header" -> a single bold, high-contrast image generation, no video needed.`;

const SYSTEM_INSTRUCTION = `You are Revolio Autopilot, the planning brain behind a creative studio app. You're having an ongoing conversation with a user — they send a brief or a follow-up instruction, and each time you respond with a plan of what should change: brand-new generation steps to add, and/or edits or removals to steps you already planned earlier in this thread that haven't run yet.

Rules:
- Only use a modelId that appears verbatim in the provided catalog. Never invent one.
- Each step's "category" must exactly match that model's category in the catalog.
- If the follow-up is asking to CHANGE something about a step you already planned — a different model, a different duration/aspect ratio, a reworded prompt, anything like "change step 2 to use X" or "make the video 720p instead" — and that step's status in "Already planned" below is "pending", set that step object's "editIndex" to its exact absolute index and describe the step's FULL new definition (label/category/modelId/prompt, etc, same shape as any other step). This replaces that step in place — do NOT also emit a separate brand-new step for the same change. Never set "editIndex" on a step whose status isn't "pending" (it already ran or is running); if the user wants to redo one of those, plan a genuinely new step instead, chained off it with "referenceFromStep" if that makes sense.
- If the follow-up is asking to REMOVE, delete, cancel, or drop specific already-planned steps — including "keep only X" (meaning: remove every other pending step) — put their exact absolute indices in the top-level "removeIndices" array. Only "pending" steps can be removed this way. Actually remove what should go rather than leaving it in place and adding something else alongside it.
- For brand-new steps (no "editIndex"), keep each response as short as actually needed — usually 1-4 new steps. Only chain steps when a later step genuinely depends on an earlier one's output (e.g. generate an image, then turn it into a video; generate a photo, then remove its background; generate a video, then upscale it).
- Set "referenceFromStep" to the absolute index (shown in "Already planned" below, or one of your own new steps' assigned indices) of an earlier step whose output this step's model should use as its input reference/video. Omit it (or use null) when a step has no such dependency.
- If reference images were attached to this message (see "Attached reference images" below), set "usesReferenceLabels" to the number(s) of whichever of those images this step should actually use as input (e.g. [1] or [1,2]) — only on steps that genuinely need one of them. Omit it if a step doesn't need any. If the brief clearly wants an attached image actually used — it says "these images", "this character", "the photo I attached", names a specific "Image N", or the description shown for an image is obviously what the brief is describing — you MUST set "usesReferenceLabels" on at least one step; don't silently plan around it as if nothing was attached.
- Write each step's "prompt" as a complete, vivid, standalone generation prompt — not a restatement of the brief. For a step that consumes a prior step's output or an attached reference image, the prompt should describe what to DO to/with it (e.g. "Animate this product photo with a slow cinematic push-in" or "Put these two characters back-to-back in a boxing pose"), not describe the reference itself.
- For video steps, only set "aspectRatio" and "duration" if the chosen model's catalog entry lists them as options — use one of the exact listed values.
- If this is a follow-up (an "Already planned" list is present below), only plan, edit, or remove what the NEW message is actually asking for — don't replan or repeat steps that already exist and weren't mentioned. Build on what's already there.
- If the brief/follow-up is too vague to plan concretely, make a single reasonable creative interpretation rather than asking a clarifying question — the user will review and can send another follow-up if it's off.
- Never produce sexual content involving minors, or any content that violates a general-audience creative platform's content policy.

${RECIPE_INSPIRATION}`;

// Plain lowercase JSON-Schema types here — this is embedded straight into
// the planning system prompt as instructional text (see generateJson in
// gemini.ts), not passed to a schema-enforcing API parameter, since muapi's
// LLM endpoints don't expose one. An LLM reading this as prompt guidance
// parses conventional JSON Schema more reliably than a provider's own
// proprietary uppercase dialect (OBJECT/ARRAY/STRING) would read as plain text.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short human label, e.g. 'Generate the hero shot'." },
          category: { type: "string", enum: ["image", "video", "3d", "audio"] },
          modelId: { type: "string" },
          prompt: { type: "string" },
          aspectRatio: { type: "string" },
          duration: { type: "number" },
          referenceFromStep: { type: "number", description: "Absolute index of an earlier step to use as input, if any." },
          usesReferenceLabels: {
            type: "array",
            items: { type: "number" },
            description: "1-based number(s) of attached reference image(s) this step should use, if any.",
          },
          editIndex: {
            type: "number",
            description: "Absolute index of an existing PENDING step this entry replaces in place. Omit entirely for a brand-new step.",
          },
        },
        required: ["label", "category", "modelId", "prompt"],
      },
    },
    removeIndices: {
      type: "array",
      items: { type: "number" },
      description: "Absolute indices of existing PENDING steps to remove outright, with no replacement.",
    },
  },
  required: ["steps"],
};

interface RawPlanStep {
  label: string;
  category: string;
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  referenceFromStep?: number | null;
  usesReferenceLabels?: number[];
  /** Absolute index of an existing PENDING step this entry replaces in place — absent for a brand-new step. */
  editIndex?: number | null;
}

interface RawPlan {
  steps: RawPlanStep[];
  /** Absolute indices of existing PENDING steps to remove outright. */
  removeIndices?: number[];
}

export class PlanningError extends Error {}

function formatExistingSteps(existingSteps: OrchestratorStep[]): string {
  if (existingSteps.length === 0) return "";
  const lines = existingSteps
    .map((s) => `${s.index}: [${s.status}] ${s.label} — ${s.category}/${s.modelId} — "${s.prompt.slice(0, 80)}${s.prompt.length > 80 ? "…" : ""}"`)
    .join("\n");
  return `\n\nAlready planned in this thread so far (absolute index: status, label — model — prompt):\n${lines}`;
}

/** One reference image attached via the @ picker — `tag` is either what the user typed for it, or an auto-generated caption (see `tagUntaggedReferences` below). */
export interface TaggedReference {
  url: string;
  tag?: string;
}

function formatReferences(references: TaggedReference[]): string {
  if (references.length === 0) return "";
  const lines = references
    .map((r, i) => `Image ${i + 1}${r.tag?.trim() ? ` — shows: ${r.tag.trim()}` : ""}: ${r.url}`)
    .join("\n");
  return `\n\nAttached reference images (refer to these by number in "usesReferenceLabels" — the "shows:" description, when present, is what that image actually contains, since you can only visually see the first one yourself):\n${lines}`;
}

/**
 * Fills in a caption for every reference the user didn't manually tag, via a
 * quick vision call per image (see describeImage in lib/gemini.ts). Only
 * bothers when there's more than one reference — with just one, the main
 * planning call already sees it directly (muapi's LLM endpoints take a
 * single `image_url`), so a caption would be redundant. Best-effort: a
 * captioning failure for one image doesn't block the others or the plan
 * itself — that image just falls back to being untagged, same as before this
 * feature existed.
 */
async function tagUntaggedReferences(references: TaggedReference[], captionModel: string): Promise<TaggedReference[]> {
  if (references.length <= 1) return references;
  return Promise.all(
    references.map(async (r) => {
      if (r.tag?.trim()) return r;
      try {
        const tag = await describeImage({ model: captionModel, imageUrl: r.url });
        return tag ? { ...r, tag } : r;
      } catch {
        return r;
      }
    })
  );
}

/**
 * Calls this thread's chosen LLM (via muapi) to plan a brief or follow-up,
 * then validates everything it proposes against the real model registry
 * before returning anything — a hallucinated modelId or a category mismatch
 * is dropped rather than trusted, since an unvalidated plan could otherwise
 * submit a generation with a broken payload shape (or silently bill for a
 * model the user never actually saw described anywhere).
 *
 * A follow-up can do three distinct things, all in one response: introduce
 * brand-new steps (`steps`, indexed to continue directly after
 * `existingSteps`), edit an already-planned but not-yet-run step in place
 * (`updatedSteps`, same absolute index as before), or drop already-planned
 * steps outright (`removedIndices`). The caller is responsible for applying
 * all three onto the thread's running `plan` array. Only steps whose status
 * is still "pending" are ever eligible for an edit or a removal — anything
 * already running/completed/failed is treated as immutable history.
 */
export async function planBrief(params: {
  /** The new user message — either the thread's opening brief or a follow-up. */
  instruction: string;
  /** muapi LLM endpoint slug — see lib/plannerModels.ts. */
  plannerModel: string;
  /** Every step already in this thread (empty for a brand-new thread). */
  existingSteps: OrchestratorStep[];
  /** Images attached to this message via the @ reference picker, if any — each with an optional user-supplied tag (auto-captioned here when missing and there's more than one). */
  references?: TaggedReference[];
}): Promise<{
  steps: OrchestratorStep[];
  updatedSteps: OrchestratorStep[];
  removedIndices: number[];
  totalCostUsd: number;
}> {
  const { instruction, existingSteps } = params;
  const taggedReferences = await tagUntaggedReferences(params.references ?? [], getLlmModel(params.plannerModel).id);
  const referenceUrls = taggedReferences.map((r) => r.url);
  const startIndex = existingSteps.length;
  const catalog = catalogModels();

  const prompt = `Catalog of available models (id | category/mode | label — tagline (notes)):\n${formatCatalog(
    catalog
  )}${formatExistingSteps(existingSteps)}${formatReferences(taggedReferences)}

${existingSteps.length > 0 ? "User's follow-up" : "User's brief"}: "${instruction.trim()}"

For any BRAND-NEW step (one with no "editIndex"), number it starting at absolute index ${startIndex} — the first new step you add = ${startIndex}, the second = ${startIndex + 1}, and so on, counting only new steps in that order (an edited step keeps its own existing index instead and doesn't consume one of these numbers). Use these new numbers, or an edited step's own existing index, if a later new step's "referenceFromStep" needs to point at one of them.

Return the plan as JSON.`;

  let raw: RawPlan;
  try {
    raw = await generateJson<RawPlan>({
      model: getLlmModel(params.plannerModel).id,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      responseSchema: RESPONSE_SCHEMA,
      imageUrl: referenceUrls[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Planning request failed";
    throw new PlanningError(message);
  }

  const rawSteps = raw.steps ?? [];
  const rawRemoveIndices = Array.isArray(raw.removeIndices) ? raw.removeIndices : [];
  if (rawSteps.length === 0 && rawRemoveIndices.length === 0) {
    throw new PlanningError("Autopilot couldn't turn that into a plan — try being a bit more specific.");
  }

  // Only a step that hasn't run yet can be edited or removed — history that
  // already executed (or is executing right now) stays put no matter what
  // the model proposes for its index.
  const pendingIndices = new Set(existingSteps.filter((s) => s.status === "pending").map((s) => s.index));

  const steps: OrchestratorStep[] = [];
  const updatedStepsByIndex = new Map<number, OrchestratorStep>();
  let totalCostUsd = 0;
  // Maps each brand-new step's *claimed* absolute index (per the numbering
  // the prompt told the model to use, counting only new steps) to its
  // actual final absolute index once invalid steps are dropped — a
  // model/category mismatch earlier in the batch shifts every new step
  // after it down by one, so a referenceFromStep pointing at a claimed
  // index has to be remapped through here rather than trusted as-is.
  const claimedToFinalIndex = new Map<number, number>();
  let newCounter = 0;

  // Resolves a raw "referenceFromStep" value to a real, still-valid
  // absolute index, or null if it doesn't resolve to anything usable.
  function resolveReferenceFromStep(value: unknown, selfIndex: number): number | null {
    if (typeof value !== "number" || value === selfIndex) return null;
    if (value < startIndex) {
      // Points at an already-existing step from an earlier turn (including
      // one being edited right now, which keeps its index) — valid as long
      // as it still exists and isn't being dropped by this same batch.
      const exists = existingSteps.some((e) => e.index === value);
      return exists && !rawRemoveIndices.includes(value) ? value : null;
    }
    // Points into this same batch's brand-new steps.
    const mapped = claimedToFinalIndex.get(value);
    return mapped !== undefined ? mapped : null;
  }

  function resolveReferenceUrls(labels: unknown): string[] | null {
    if (!Array.isArray(labels) || labels.length === 0) return null;
    const urls = labels
      .map((label) => (Number.isInteger(label) && label >= 1 && label <= referenceUrls.length ? referenceUrls[label - 1] : null))
      .filter((url): url is string => Boolean(url));
    return urls.length > 0 ? urls : null;
  }

  rawSteps.forEach((s) => {
    const model = getModel(s.modelId);
    // Drop (rather than coerce) any step whose model doesn't exist or whose
    // declared category doesn't match reality — trusting either would mean
    // building a generate payload for a model config that isn't what the
    // rest of the app thinks it is.
    if (!model || model.category !== s.category || model.unavailable) return;

    const settings: Record<string, unknown> = {};
    if (s.aspectRatio && model.aspectRatios?.includes(s.aspectRatio)) settings.aspectRatio = s.aspectRatio;
    if (typeof s.duration === "number" && model.durations?.includes(s.duration)) settings.duration = s.duration;

    const costUsd = estimateCostUSD(model, {
      duration: (settings.duration as number) ?? model.defaultDuration,
    });

    // A step only counts as an edit if it claims a target that's genuinely
    // still pending — an edit aimed at a completed/running/nonexistent step
    // (or a hallucinated index) falls back to being treated as a brand-new
    // step instead of silently vanishing.
    const editTarget = typeof s.editIndex === "number" && pendingIndices.has(s.editIndex) ? s.editIndex : null;

    if (editTarget !== null) {
      updatedStepsByIndex.set(editTarget, {
        index: editTarget,
        label: s.label?.trim() || model.label,
        category: model.category as Category,
        modelId: model.id,
        prompt: s.prompt?.trim() || "",
        settings,
        referenceFromStep: resolveReferenceFromStep(s.referenceFromStep, editTarget),
        referenceUrls: resolveReferenceUrls(s.usesReferenceLabels),
        status: "pending",
        generationId: null,
        outputUrl: null,
        error: null,
        costUsd,
      });
      return;
    }

    const finalIndex = startIndex + newCounter;
    claimedToFinalIndex.set(startIndex + newCounter, finalIndex);
    newCounter += 1;
    totalCostUsd += costUsd;

    steps.push({
      index: finalIndex,
      label: s.label?.trim() || model.label,
      category: model.category as Category,
      modelId: model.id,
      prompt: s.prompt?.trim() || "",
      settings,
      referenceFromStep: resolveReferenceFromStep(s.referenceFromStep, finalIndex),
      referenceUrls: resolveReferenceUrls(s.usesReferenceLabels),
      status: "pending",
      generationId: null,
      error: null,
      costUsd,
    });
  });

  // A removal only applies to a step that's still pending and wasn't also
  // just edited in this same batch — if the model somehow emitted both for
  // one index, the edit (the more specific instruction) wins.
  const removedIndices = rawRemoveIndices.filter((i) => pendingIndices.has(i) && !updatedStepsByIndex.has(i));
  const updatedSteps = Array.from(updatedStepsByIndex.values());

  if (steps.length === 0 && updatedSteps.length === 0 && removedIndices.length === 0) {
    throw new PlanningError("Autopilot's plan didn't match any real models — try rephrasing.");
  }

  return {
    steps,
    updatedSteps,
    removedIndices,
    totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
  };
}
