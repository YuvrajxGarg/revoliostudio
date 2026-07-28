import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CharacterSheet } from "@/lib/characterSheet-types";

export const runtime = "nodejs";

/**
 * Same-origin proxy for one slot's output image — the 24 shots are hosted on
 * muapi's own CDN, not Revolio's Supabase storage, and there's no guarantee
 * those URLs send Access-Control-Allow-Origin. Drawing a cross-origin image
 * without it taints the canvas the poster compositor builds, and
 * `toBlob`/`toDataURL` throws SecurityError at export time. Routing through
 * this same-origin endpoint instead sidesteps that regardless of muapi's own
 * CORS headers — see the Character Sheet plan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slotParam = new URL(request.url).searchParams.get("slot");
  const slotIndex = slotParam !== null ? Number(slotParam) : NaN;
  if (!Number.isInteger(slotIndex)) return NextResponse.json({ error: "Missing or invalid slot" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("character_sheets")
    .select("slots")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheet = row as Pick<CharacterSheet, "slots">;
  const slot = sheet.slots.find((s) => s.index === slotIndex);
  if (!slot?.outputUrl) return NextResponse.json({ error: "This shot isn't ready yet" }, { status: 404 });

  const upstream = await fetch(slot.outputUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Failed to fetch this shot" }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
