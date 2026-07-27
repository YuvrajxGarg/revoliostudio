import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Add or remove a member on a "team" project. Mirrors /api/shares: there's
 * no email-invite/notification pipeline — "inviting" someone looks them up
 * by email/name among existing Revolio users (search_profiles(), same RPC
 * the generation Share dialog uses) and adds them straight to
 * project_members with immediate access. A person without a Revolio account
 * can't be invited until they sign up.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  // Only the project's owner can invite — RLS enforces this too (see the
  // "owners add members" policy in 0025), but a clear error beats a generic
  // RLS-denied insert failure.
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, type, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Project not found, or you're not its owner" }, { status: 404 });
  }
  if (project.type !== "team") {
    return NextResponse.json(
      { error: 'Only "team" projects can have members — this one is personal.' },
      { status: 400 }
    );
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "You're already the owner of this project" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_members")
    .upsert({ project_id: projectId, user_id: userId, role: "editor", added_by: user.id }, { onConflict: "project_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: invitedProfile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .single();
  await supabase.from("notifications").insert({
    title: `You were added to "${project.name}"`,
    body: `${invitedProfile?.display_name || invitedProfile?.email || "Someone"} can now see this team project.`,
    created_by: user.id,
    user_id: userId,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  // RLS ("owners remove members or members leave") already restricts this to
  // either the project owner or the member removing themselves — no extra
  // ownership check needed server-side beyond that.
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
