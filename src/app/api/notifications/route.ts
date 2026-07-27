import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

/** Any signed-in user: the latest broadcast notifications, annotated with
 * whether *this* user has already seen (read) each one. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (notifications ?? []).map((n) => n.id);
  let readIds = new Set<string>();
  if (ids.length > 0) {
    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user.id)
      .in("notification_id", ids);
    readIds = new Set((reads ?? []).map((r) => r.notification_id as string));
  }

  const items: NotificationItem[] = (notifications ?? []).map((n) => ({
    ...n,
    read: readIds.has(n.id),
  }));

  return NextResponse.json({ notifications: items });
}
