import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Any signed-in user: mark one or more notifications as read/seen for
 * themselves — used both when a toast popup is shown and when the Inbox
 * dropdown is opened, so a notification never pops up again after either. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ids = (body.ids ?? []).filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return NextResponse.json({ ok: true });

  const rows = ids.map((notification_id) => ({ notification_id, user_id: user.id }));
  // Upsert so re-marking an already-read notification (e.g. a duplicate
  // click) doesn't throw a primary-key conflict.
  const { error } = await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
