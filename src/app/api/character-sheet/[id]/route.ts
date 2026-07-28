import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pollGenerationStatus } from "@/lib/pollGeneration";
import type { CharacterSheet, CharacterSheetSlot } from "@/lib/characterSheet-types";

export const runtime = "nodejs";

/**
 * Polled every ~2s by the client while a sheet is "generating" — the same
 * per-row polling `pollGenerationStatus` already does for the gallery
 * (useGenerations.ts) and Autopilot's single-step runs, just fanned out over
 * every one of the sheet's 24 slots at once with Promise.all instead of one
 * row at a time.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("character_sheets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sheet = row as CharacterSheet;

  if (sheet.status !== "generating") return NextResponse.json(sheet);

  const slots: CharacterSheetSlot[] = await Promise.all(
    sheet.slots.map(async (slot) => {
      if (slot.status === "completed" || slot.status === "failed" || !slot.generationId) return slot;
      const generation = await pollGenerationStatus(supabase, slot.generationId);
      if (!generation) return slot;
      if (generation.status === "completed") {
        return { ...slot, status: "completed", outputUrl: generation.output_urls?.[0] ?? null };
      }
      if (generation.status === "failed") {
        return { ...slot, status: "failed", error: generation.error ?? "Failed" };
      }
      return { ...slot, status: "processing" };
    })
  );

  // A slot that failed doesn't fail the whole sheet — it just renders as an
  // empty/retry-able tile once composited (see the Character Sheet plan).
  const allSettled = slots.every((s) => s.status === "completed" || s.status === "failed");
  const status = allSettled ? "completed" : "generating";

  const { data: updated, error: updateError } = await supabase
    .from("character_sheets")
    .update({ slots, status })
    .eq("id", id)
    .select()
    .single();
  if (updateError || !updated) return NextResponse.json(sheet);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("character_sheets").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
