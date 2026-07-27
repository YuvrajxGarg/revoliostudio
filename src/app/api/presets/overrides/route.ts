import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Public (any signed-in user) read of admin-edited preset prompt overrides —
 * see supabase/migrations/0031_preset_prompt_overrides.sql. Returns a sparse
 * `{ [presetId]: prompt }` map; presets with no row here just keep their
 * original hardcoded prompt from src/lib/presets.ts. Fetched once client-side
 * (see usePresetOverrides.ts) and merged in whenever a Featured Template is
 * turned into an active preset.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("preset_prompt_overrides").select("preset_id, prompt");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const overrides: Record<string, string> = {};
  for (const row of data ?? []) overrides[row.preset_id as string] = row.prompt as string;
  return NextResponse.json({ overrides });
}
