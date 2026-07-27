import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// This route is no longer the primary upload path — the browser now uploads
// directly to Supabase Storage (see src/lib/upload.ts) so requests aren't
// bounded by Vercel's ~4.5MB serverless-function body limit, which used to
// silently reject anything over that size before this route's own checks
// ever ran. Kept as a fallback/legacy endpoint with matching limits in case
// anything still calls it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "only image or video files are supported" }, { status: 400 });
  }
  // Video cap matches Supabase Storage's free-plan per-file ceiling — going
  // higher just means the upload fails at Supabase's layer with a worse
  // error instead of here.
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/${Date.now()}-${nanoid(6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl, name: file.name });
}
