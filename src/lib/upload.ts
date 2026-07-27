"use client";

import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";

// Matches muapi's own reference-image cap.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// Matches Supabase Storage's hard per-file ceiling on the free plan — going
// higher here would just mean the upload fails at Supabase's layer instead
// of ours, with a worse error message.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface UploadResult {
  url: string;
  name: string;
}

function formatMB(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 10 ? `${Math.round(mb)}MB` : `${mb.toFixed(1)}MB`;
}

/**
 * Uploads a reference image/video directly from the browser to Supabase
 * Storage's public "media" bucket, instead of proxying through our own
 * /api/upload Next.js route.
 *
 * Why: that route ran as a Vercel serverless function, and Vercel caps
 * request bodies on serverless functions at roughly 4.5MB — well under
 * both our advertised 25MB image cap and muapi's real limit. Any file over
 * ~4.5MB was rejected by Vercel's platform layer *before* our route's own
 * size check ever ran, which is also why the failure showed up client-side
 * as a generic, unhelpful message instead of a real error. Uploading
 * straight to Supabase's own endpoint removes that ceiling entirely — the
 * only limit left is Supabase's, which is 50MB/file on the free plan
 * (hence MAX_VIDEO_BYTES matching it exactly).
 *
 * Every failure mode (wrong type, too large, not signed in, network/storage
 * error) throws an Error with a real, human-readable message so callers can
 * show it as-is instead of falling back to "Failed to upload image".
 */
export async function uploadReferenceFile(file: File): Promise<UploadResult> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Only image or video files are supported.");
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `File too large: ${formatMB(file.size)} (max ${formatMB(maxBytes)} for ${isVideo ? "videos" : "images"}).`
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You need to be signed in to upload files.");
  }

  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "png");
  const path = `${user.id}/${Date.now()}-${nanoid(6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    // Surface Supabase's actual message (e.g. its own size-limit rejection)
    // rather than masking it.
    throw new Error(uploadError.message || "Upload failed — check your connection and try again.");
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}
