import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRESET_TEMPLATES } from "@/lib/presets";

export const runtime = "nodejs";

/**
 * Admin CRUD for preset prompt overrides — lets an admin update the
 * hardcoded `prompt` field on any Featured Template (src/lib/presets.ts)
 * without touching code, e.g. after finding a better prompt/combination
 * elsewhere. Reset (DELETE) reverts a preset back to its original prompt.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preset_prompt_overrides")
    .select("preset_id, prompt, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overrides: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { presetId?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const presetId = body.presetId?.trim();
  const prompt = body.prompt?.trim();
  if (!presetId) return NextResponse.json({ error: "presetId is required" }, { status: 400 });
  if (!PRESET_TEMPLATES.some((p) => p.id === presetId)) {
    return NextResponse.json({ error: "Unknown preset id" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preset_prompt_overrides")
    .upsert({ preset_id: presetId, prompt, updated_by: user.id, updated_at: new Date().toISOString() })
    .select("preset_id, prompt, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ override: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const presetId = searchParams.get("presetId");
  if (!presetId) return NextResponse.json({ error: "presetId is required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("preset_prompt_overrides").delete().eq("preset_id", presetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
