import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleGenerateRequest } from "@/lib/generate";
import { generateJson, GeminiError } from "@/lib/gemini";
import { DEFAULT_LLM_MODEL } from "@/lib/llmModels";
import { buildCharacterSheetSlots, aspectRatioForQuality } from "@/lib/characterSheetSlots";
import { getCharacterModelOption } from "@/lib/characterSheetModels";
import type { CharacterMetadata, CharacterSheetQuality, CharacterSheetSlot } from "@/lib/characterSheet-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const METADATA_SYSTEM_INSTRUCTION =
  "You analyze a single reference photo of a person for a character-consistency tool. Look closely and describe what's actually visible — plain, factual, physical description only, no commentary. `anchorPhrase` is a single dense sentence (40-70 words) combining every field below into one reusable description another AI image model will read before every generation, e.g. \"A 28 year old South Asian man, medium build, 5'9\\\", black thick hair, dark brown eyes, warm brown skin tone, light stubble, wearing a plain black crew-neck shirt.\" If something genuinely isn't visible (e.g. height from a headshot), make a reasonable visual estimate rather than leaving it vague.";

const METADATA_SCHEMA = {
  age: "string (e.g. '28')",
  ethnicity: "string",
  height: "string (e.g. '5'9\" / 175cm', best visual estimate)",
  build: "string (e.g. 'Athletic', 'Slim', 'Stocky')",
  eyes: "string (color + notable shape)",
  hair: "string (color, length, texture, style)",
  skinTone: "string",
  distinguishingMarks: "string (scars, moles, freckles, tattoos — or 'None visible')",
  style: "string (clothing/overall aesthetic visible in the photo)",
  anchorPhrase: "string — one dense reusable description, see instructions",
};

async function generateCharacterMetadata(faceUrl: string): Promise<CharacterMetadata> {
  return generateJson<CharacterMetadata>({
    model: DEFAULT_LLM_MODEL,
    systemInstruction: METADATA_SYSTEM_INSTRUCTION,
    prompt: "Analyze this reference photo and return the character metadata.",
    responseSchema: METADATA_SCHEMA,
    imageUrl: faceUrl,
  });
}

/** Submits one shot by constructing a synthetic Request and calling the
 * exact same handleGenerateRequest("image", ...) path every other studio
 * composer's submit button already goes through — same insert (queued ->
 * processing/completed) + non-blocking muapi submit, just called in a loop
 * instead of once. Auth comes from the ambient request's cookies (via
 * createClient() inside handleGenerateRequest itself), not from this
 * synthetic Request object — it's only ever used for its .json() body. */
async function submitSlot(
  slot: CharacterSheetSlot,
  faceUrl: string,
  modelId: string,
  aspectRatio: string
): Promise<CharacterSheetSlot> {
  const req = new Request("http://internal/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId,
      prompt: slot.prompt,
      references: [faceUrl],
      settings: { aspectRatio },
      toolId: "character-sheet",
    }),
  });
  try {
    const res = await handleGenerateRequest("image", req);
    const data = await res.json();
    if (!res.ok) {
      return { ...slot, status: "failed", error: data?.error || "Failed to start this shot" };
    }
    return {
      ...slot,
      status: data.status === "completed" ? "completed" : "processing",
      generationId: data.id,
      outputUrl: data.output_urls?.[0] ?? null,
    };
  } catch (err) {
    return { ...slot, status: "failed", error: err instanceof Error ? err.message : "Failed to start this shot" };
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { faceUrl?: string; quality?: string; modelId?: string; selectedSlotIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const faceUrl = body.faceUrl?.trim();
  if (!faceUrl) return NextResponse.json({ error: "Upload a reference photo first" }, { status: 400 });
  const quality: CharacterSheetQuality = body.quality === "studio" ? "studio" : "compact";
  const modelOption = getCharacterModelOption(body.modelId);
  const selectedSlotIds = Array.isArray(body.selectedSlotIds) ? body.selectedSlotIds.filter((id) => typeof id === "string") : [];

  const { data: row, error: insertError } = await supabase
    .from("character_sheets")
    .insert({
      user_id: user.id,
      source_face_url: faceUrl,
      quality,
      model_id: modelOption.id,
      metadata: null,
      slots: [],
      status: "analyzing",
    })
    .select()
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message || "Failed to start this sheet" }, { status: 500 });
  }

  let metadata: CharacterMetadata;
  try {
    metadata = await generateCharacterMetadata(faceUrl);
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Couldn't analyze the reference photo";
    await supabase.from("character_sheets").update({ status: "failed", error: message }).eq("id", row.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const aspectRatio = aspectRatioForQuality(quality);
  const initialSlots = buildCharacterSheetSlots(metadata.anchorPhrase, selectedSlotIds);
  const totalCostUsd = Math.round(initialSlots.length * modelOption.costPerImageUsd * 1000) / 1000;
  // Fired concurrently — each is its own insert + non-blocking muapi submit,
  // so this resolves in roughly one submit round-trip, not N of them
  // serialized (see the Character Sheet plan for why advanceRun's strictly
  // one-step-at-a-time engine doesn't fit this).
  const submittedSlots = await Promise.all(
    initialSlots.map((slot) => submitSlot(slot, faceUrl, modelOption.id, aspectRatio))
  );

  const { data: updated, error: updateError } = await supabase
    .from("character_sheets")
    .update({ metadata, slots: submittedSlots, status: "generating", total_cost_usd: totalCostUsd })
    .eq("id", row.id)
    .select()
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || "Failed to start generating this sheet" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
