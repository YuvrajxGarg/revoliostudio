import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** Fetch a single flow (owner's own, or any published one). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("flows")
    .select("*, author:profiles(display_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

/** Update a flow the user owns — publish toggle, rename, edit description. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.inputLabel === "string") patch.input_label = body.inputLabel.trim() || "Input";
  if (typeof body.isPublic === "boolean") {
    patch.is_public = body.isPublic;
    patch.published_at = body.isPublic ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("flows")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Update failed" }, { status: 500 });
  return NextResponse.json(data);
}

/** Delete a flow the user owns. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("flows").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
