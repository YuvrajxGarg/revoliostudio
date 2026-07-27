import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** List the current user's spaces. */
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return NextResponse.json(data ?? []);
}

/** Create a new (blank or seeded) space. */
export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      user_id: user.id,
      name: (body.name as string)?.trim() || "Untitled space",
      graph: body.graph ?? { nodes: [], edges: [] },
    })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Failed to create space" }, { status: 500 });
  return NextResponse.json(data);
}
