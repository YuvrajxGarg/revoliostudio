/**
 * Thin server-side client for Photoroom's Remove Background API (Basic
 * plan) — swapped in for muapi's own background remover per user feedback
 * that its cutouts weren't clean. Unlike muapi, this is a single
 * synchronous call: POST the image bytes, get the cut-out PNG bytes back
 * directly — no request_id/poll step.
 *
 * Docs: https://docs.photoroom.com/remove-background-api-basic-plan/quickstart-guide
 * Endpoint: POST https://sdk.photoroom.com/v1/segment (multipart/form-data)
 * Auth header: x-api-key: <PHOTOROOM_API_KEY>
 *
 * This file must only be imported from server code — it reads the secret
 * API key from the environment.
 */

const SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

export class PhotoroomError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PhotoroomError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) {
    throw new PhotoroomError(
      "PHOTOROOM_API_KEY is not set. Add it to your environment variables.",
      0
    );
  }
  return key;
}

export interface RemoveBackgroundOptions {
  /** Hex (no #) or CSS color name. Omit for a transparent background. */
  bgColor?: string;
  /** preview (0.25MP) / medium (1.5MP) / hd (4MP) / full (36MP, default). */
  size?: "preview" | "medium" | "hd" | "full";
  /** Crop the result to the cutout's bounding box (drops transparent border). */
  crop?: boolean;
}

/**
 * Fetches the image at `sourceUrl`, sends it to Photoroom's segment
 * endpoint, and returns the cut-out image as raw PNG bytes. Throws
 * PhotoroomError on any failure (missing key, fetch failure, non-2xx,
 * non-image response) with a message safe to surface to the user.
 */
export async function removeBackgroundPhotoroom(
  sourceUrl: string,
  options: RemoveBackgroundOptions = {}
): Promise<Buffer> {
  const apiKey = getApiKey();

  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    throw new PhotoroomError(`Couldn't fetch the source image (${sourceRes.status}).`, sourceRes.status);
  }
  const sourceBlob = await sourceRes.blob();

  const form = new FormData();
  form.append("image_file", sourceBlob, "source.png");
  form.append("format", "png"); // real alpha channel, not a flattened jpeg
  if (options.bgColor) form.append("bg_color", options.bgColor);
  if (options.size) form.append("size", options.size);
  if (options.crop !== undefined) form.append("crop", String(options.crop));

  const res = await fetch(SEGMENT_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.startsWith("image/")) {
    // Photoroom returns JSON error bodies on failure (see API reference:
    // `{"error": {"message": "..."}}` or `{"detail": "..."}`).
    const text = await res.text();
    let message = text || `Photoroom request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.detail || message;
    } catch {
      // not JSON — keep the raw text
    }
    throw new PhotoroomError(message, res.status);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
