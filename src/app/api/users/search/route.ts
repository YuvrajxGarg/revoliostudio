import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export interface SearchedUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Recipient picker for the Share dialog — searches every profile by email
 * or display name via the search_profiles() SECURITY DEFINER RPC (a plain
 * table query would be blocked by RLS, since normal users can only read
 * profiles they're already share-connected to). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const { data, error } = await supabase.rpc("search_profiles", { search_query: q });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: (data ?? []) as SearchedUser[] });
}
