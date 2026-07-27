import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Create (or reuse) a public, 24h-expiring share link for a generation.
 *
 * Rather than pointing the public link at the origin muapi CDN (which can
 * rotate/expire and isn't ours), we copy the media into our own Supabase
 * Storage "media" bucket under `shared/<token>.<ext>` and serve that. The
 * link row carries `expires_at` (default now()+24h, see 0028); an hourly
 * pg_cron job deletes expired rows, and the get_shared_generation RPC also
 * filters on expiry so an expired token dies immediately regardless.
 */
export async function POST(req: Request) {
  const { generationId } = await req.json().catch(() => ({}));
  if (!generationId) return NextResponse.json({ error: "Missing generationId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Ownership check — only the owner may mint a public link.
  const { data: gen } = await supabase
    .from("generations")
    .select("id, user_id, output_urls, category")
    .eq("id", generationId)
    .single();
  if (!gen || gen.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const svc = createServiceClient();

  // Reuse a still-valid link if one exists.
  const { data: existing } = await svc
    .from("generation_share_links")
    .select("token, expires_at")
    .eq("generation_id", generationId)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existing?.token) {
    return NextResponse.json({ token: existing.token, expiresAt: existing.expires_at });
  }

  // Create the row first so we have a token + default expiry.
  const { data: link, error: linkErr } = await svc
    .from("generation_share_links")
    .insert({ generation_id: generationId, created_by: user.id })
    .select("token, expires_at")
    .single();
  if (linkErr || !link) {
    return NextResponse.json({ error: linkErr?.message || "Failed to create link" }, { status: 500 });
  }

  // Best-effort copy of the media into our own bucket. If the fetch/upload
  // fails we still return the link (the public page falls back to the origin
  // URL) rather than blocking sharing on a storage hiccup.
  const mediaUrl: string | undefined = gen.output_urls?.[0];
  let sharedUrl: string | null = null;
  let storagePath: string | null = null;
  if (mediaUrl) {
    try {
      const res = await fetch(mediaUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const ext =
          gen.category === "video" ? "mp4" : gen.category === "audio" ? "mp3" : contentType.split("/")[1] || "png";
        const path = `shared/${link.token}.${ext}`;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { error: upErr } = await svc.storage
          .from("media")
          .upload(path, bytes, { contentType, upsert: true });
        if (!upErr) {
          storagePath = path;
          sharedUrl = svc.storage.from("media").getPublicUrl(path).data.publicUrl;
          await svc
            .from("generation_share_links")
            .update({ storage_path: storagePath, shared_url: sharedUrl })
            .eq("token", link.token);
        }
      }
    } catch {
      // fall through — link still works via the origin URL
    }
  }

  return NextResponse.json({ token: link.token, expiresAt: link.expires_at });
}
