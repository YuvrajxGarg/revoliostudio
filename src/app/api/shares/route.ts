import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Generation } from "@/lib/types";

export const runtime = "nodejs";

const PAGE_SIZE = 24;

export interface SharedFrom {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Generations shared with the current user, newest first, paginated —
 * powers the Gallery's "Shared" tab. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "0") || 0;

  const { data: shares, error } = await supabase
    .from("shared_generations")
    .select("id, created_at, generation_id, from_user_id")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!shares || shares.length === 0) {
    return NextResponse.json({ shares: [], hasMore: false });
  }

  const genIds = Array.from(new Set(shares.map((s) => s.generation_id)));
  const fromIds = Array.from(new Set(shares.map((s) => s.from_user_id)));

  const [{ data: generations }, { data: senders }] = await Promise.all([
    // Exclude anything the sender has since moved to Trash — a soft-deleted
    // generation shouldn't keep showing up in someone else's Shared tab.
    supabase.from("generations").select("*").in("id", genIds).is("deleted_at", null),
    supabase.from("profiles").select("id, email, display_name, avatar_url").in("id", fromIds),
  ]);

  const genById = new Map((generations ?? []).map((g) => [g.id, g as Generation]));
  const senderById = new Map((senders ?? []).map((s) => [s.id, s as SharedFrom]));

  // A generation can disappear from this join if the sender later deleted
  // it — skip those rather than surfacing a broken card.
  const items = shares
    .map((s) => {
      const generation = genById.get(s.generation_id);
      if (!generation) return null;
      const from = senderById.get(s.from_user_id) ?? null;
      return {
        ...generation,
        share_id: s.id as string,
        shared_by: from,
      };
    })
    .filter((it): it is NonNullable<typeof it> => it !== null);

  return NextResponse.json({ shares: items, hasMore: shares.length === PAGE_SIZE });
}

interface ShareRequestBody {
  generationId?: string;
  toUserIds?: string[];
}

/** Share one generation with one or more recipients — creates a
 * shared_generations row per recipient plus a targeted notification. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ShareRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const generationId = body.generationId;
  if (!generationId) {
    return NextResponse.json({ error: "generationId is required" }, { status: 400 });
  }

  const recipientIds = Array.from(new Set(body.toUserIds ?? [])).filter(
    (id) => typeof id === "string" && id && id !== user.id
  );
  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one recipient" }, { status: 400 });
  }

  // Ownership check (RLS enforces this too, but a clear error is friendlier
  // than a generic RLS-denied insert failure).
  const { data: generation } = await supabase
    .from("generations")
    .select("id, prompt, model_label")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  const rows = recipientIds.map((to_user_id) => ({
    generation_id: generationId,
    from_user_id: user.id,
    to_user_id,
  }));

  const { data: inserted, error } = await supabase
    .from("shared_generations")
    .upsert(rows, { onConflict: "generation_id,to_user_id", ignoreDuplicates: true })
    .select("id, to_user_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .single();
  const senderName = senderProfile?.display_name || senderProfile?.email || "Someone";
  const promptSnippet = generation.prompt?.trim().slice(0, 80) || generation.model_label;

  const notificationRows = recipientIds.map((to_user_id) => ({
    title: `${senderName} shared a generation with you`,
    body: promptSnippet,
    created_by: user.id,
    user_id: to_user_id,
  }));
  await supabase.from("notifications").insert(notificationRows);

  return NextResponse.json({ shared: inserted?.length ?? recipientIds.length });
}
