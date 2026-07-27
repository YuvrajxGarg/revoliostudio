import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { getModel, type Category, type ModelConfig } from "@/lib/models";
import { submitJob, extractOutputUrls, getModelSchema, MuapiError } from "@/lib/muapi";
import { removeBackgroundPhotoroom, PhotoroomError } from "@/lib/photoroom";
import { estimateCostUSD } from "@/lib/pricing";

// Candidate live-schema field names for "how many outputs" and "generate
// audio" — muapi doesn't standardize these across model providers, so we
// probe the model's real schema at submit time rather than trusting the
// static registry (some models flagged supportsNumImages have no such field
// at all, which silently no-ops the num_images we used to send blindly).
// Kept in sync with src/app/api/models/[id]/schema/route.ts's NUM_IMAGES_CANDIDATES.
const NUM_IMAGES_CANDIDATES = [
  "num_images",
  "num_outputs",
  "n",
  "batch_size",
  "samples",
  "num_samples",
  "batch_count",
  "num_variations",
  "variations",
  "count",
  "max_images",
];
const AUDIO_CANDIDATES = ["generate_audio", "with_audio", "enable_audio", "audio"];
// Kept in sync with src/app/api/models/[id]/schema/route.ts's
// STYLE_CANDIDATES / LYRICS_CANDIDATES / INSTRUMENTAL_CANDIDATES — Suno's
// and MMAudio's real field names weren't available to verify directly (see
// the doc comment on the `audio` section of src/lib/models.ts), so these
// are resolved defensively the same way num-images/resolution/audio-toggle
// already are: probe several plausible names, send whichever actually
// exists in the live schema, omit the field entirely otherwise.
const STYLE_CANDIDATES = ["style", "tags", "genre", "music_style"];
const LYRICS_CANDIDATES = ["lyrics", "custom_lyrics", "lyric"];
const INSTRUMENTAL_CANDIDATES = ["instrumental", "make_instrumental", "is_instrumental"];
// Kept in sync with src/app/api/models/[id]/schema/route.ts's RESOLUTION_CANDIDATES —
// the resolution/quality dropdown's value has to be submitted under whatever
// key the model's real schema actually uses, not always "resolution".
const RESOLUTION_CANDIDATES = [
  "resolution",
  "quality",
  "output_resolution",
  "video_resolution",
  "video_quality",
  "output_quality",
  "resolution_quality",
  "size",
];
// Kept in sync with src/app/api/models/[id]/schema/route.ts's VIDEO_REF_CANDIDATES —
// an optional secondary video reference on an otherwise image-based
// (i2v/omni) model, e.g. one image reference + one motion/scene video for a
// character-replace-style workflow. Never consulted for v2v/motion/enhance
// modes, which already have their own dedicated (and required) video field
// handled separately below.
const VIDEO_REF_CANDIDATES = ["video_url", "reference_video_url", "source_video_url", "input_video", "video"];
// Inpaint: candidate live-schema field names for a mask image on a
// `supportsMask` edit model. muapi doesn't publish a browsable catalog we
// can grep ahead of time and this sandbox's network can't reach api.muapi.ai
// directly to confirm live (see higgsfield-apps-research.md's inpaint
// discussion), so — same defensive posture as every other *_CANDIDATES list
// here — this probes several plausible names against the model's real
// schema at submit time and only sends the mask under whichever one
// actually exists, rather than guessing blind. "mask_url" is listed first
// as the best-guess default (matches this codebase's own "*_url" naming
// convention for every other image field — image_url, images_list,
// reference_video_url).
const MASK_CANDIDATES = ["mask_url", "mask_image_url", "image_mask_url", "mask"];

interface GenerateBody {
  modelId: string;
  prompt: string;
  references?: string[];
  startFrameUrl?: string | null;
  endFrameUrl?: string | null;
  /**
   * Primary video input for Edit Video (v2v) and the motion clip for Motion
   * Control — required in both cases. Also reused (optionally) by i2v/omni
   * models in the plain Create Video composer whose live schema exposes a
   * secondary video-reference field (see VIDEO_REF_CANDIDATES); harmless to
   * send for models with no such field, since buildPayload only forwards it
   * when the schema probe actually finds a match.
   */
  videoUrl?: string | null;
  /** Character image for Motion Control (runway-act-two style dual input). */
  characterImageUrl?: string | null;
  /**
   * Inpaint: a black/white PNG (white = region to edit, black = region to
   * preserve), same pixel dimensions as the source image — restricts a
   * `supportsMask` model's edit to just the painted area instead of the
   * whole image. Only meaningful alongside `references[0]` as the source
   * image. See MASK_CANDIDATES above for how the real field name is
   * resolved, and the polarity/field-name caveat in buildPayload below.
   */
  maskUrl?: string | null;
  /** Optional project this generation is filed under. */
  projectId?: string | null;
  /** Which config-driven tool studio (src/lib/toolStudios.ts id) is submitting this — null/omitted for the plain Image/Video/Audio/3D Generator. Stored on the row so each surface's gallery can filter to exactly its own output instead of every surface sharing a model (see supabase/migrations/0019_tool_scoping_and_audio.sql). */
  toolId?: string | null;
  settings?: {
    aspectRatio?: string;
    duration?: number;
    resolution?: string;
    numImages?: number;
    seed?: number;
    keepOriginalSound?: boolean;
    // ── Video audio ──────────────────────────────────────────────────────
    generateAudio?: boolean;
    // ── 3D (Meshy) ──────────────────────────────────────────────────────
    topology?: "triangle" | "quad";
    targetPolycount?: number;
    shouldRemesh?: boolean;
    symmetryMode?: "off" | "auto" | "on";
    enablePbr?: boolean;
    poseMode?: "" | "a-pose" | "t-pose";
    texturePrompt?: string;
    shouldTexture?: boolean;
    meshyMode?: "preview" | "full";
    enablePromptExpansion?: boolean;
    // ── Upscale tools ──────────────────────────────────────────────────────
    upscaleFactor?: number;
    // ── OpenAI gpt-image family ──────────────────────────────────────────
    /** Requests a real alpha-channel PNG via OpenAI's native `background`
     * param — not documented in muapi's own gpt-image-2 schema pages, but
     * OpenAI's Images API itself supports "transparent"/"opaque"/"auto" and
     * muapi's wrapper passes extra fields straight through to the provider,
     * so this is worth sending even though muapi doesn't list it. */
    transparentBackground?: boolean;
    // ── Audio (Suno / MMAudio) ──────────────────────────────────────────
    musicStyle?: string;
    lyrics?: string;
    instrumental?: boolean;
    // ── Motion mode extras (Wan Animate's animate/replace toggle) ────────
    motionMode?: string;
  };
}

async function buildPayload(model: ModelConfig, body: GenerateBody): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = { prompt: body.prompt || "" };
  const settings = body.settings ?? {};

  if (model.aspectRatios?.length) {
    payload.aspect_ratio = settings.aspectRatio || model.defaultAspectRatio;
  }
  if (model.durations?.length || settings.duration) {
    payload.duration = settings.duration || model.defaultDuration;
  }
  if (settings.seed) {
    payload.seed = settings.seed;
  }

  // OpenAI's gpt-image models support a native `background: "transparent"`
  // param for a real alpha-channel PNG — muapi's own gpt-image-2 schema
  // pages don't list it, but it's the actual OpenAI Images API param name,
  // and wrapper APIs like this one typically forward unrecognized body
  // fields straight to the upstream provider rather than stripping them.
  if (settings.transparentBackground && model.provider === "OpenAI" && model.id.startsWith("gpt-image")) {
    payload.background = "transparent";
  }

  // The static registry's `supportsNumImages`/`generateAudio`/`maxReferences`
  // fields are unreliable — some flagged models have no matching field in
  // muapi's real schema at all (e.g. nano-banana-pro has no batch field
  // whatsoever), and several video models' real reference-image limits
  // didn't match what the registry had (verified against live schemas).
  // Probe the schema once up front and reuse it below rather than trusting
  // the static numbers blindly.
  let liveProps: Record<string, { maxItems?: number; type?: string; enum?: string[] }> | null = null;
  // Only relevant outside the dedicated v2v/motion/enhance composers — those
  // already have their own required primary video field, handled in their
  // own branches below, and never read VIDEO_REF_CANDIDATES.
  const wantsOptionalVideoRef =
    !!body.videoUrl && model.mode !== "motion" && model.mode !== "v2v" && !(model.mode === "enhance" && model.requiresVideoInput);
  const needsSchema =
    model.supportsNumImages ||
    settings.generateAudio !== undefined ||
    model.imageInputKey === "images_list" ||
    !!settings.resolution ||
    model.mode === "t2a" ||
    wantsOptionalVideoRef ||
    !!body.maskUrl;
  if (needsSchema) {
    try {
      const schema = await getModelSchema(model.endpoint);
      liveProps = (schema.input_schema?.schemas?.input_data?.properties ?? {}) as Record<
        string,
        { maxItems?: number; type?: string; enum?: string[] }
      >;
    } catch {
      // Schema probe failed — fall back to the static registry/omitting
      // fields rather than guessing a name that might not exist.
      liveProps = null;
    }
  }

  if (liveProps) {
    if (model.supportsNumImages) {
      const numImagesFieldName = NUM_IMAGES_CANDIDATES.find((key) => liveProps![key]);
      if (numImagesFieldName) {
        payload[numImagesFieldName] = settings.numImages || 1;
      }
    }

    if (settings.generateAudio !== undefined) {
      const audioFieldName = AUDIO_CANDIDATES.find((key) => liveProps![key]?.type === "boolean");
      if (audioFieldName) {
        payload[audioFieldName] = settings.generateAudio;
      }
    }

    if (model.mode === "t2a") {
      if (settings.musicStyle?.trim()) {
        const styleFieldName = STYLE_CANDIDATES.find((key) => liveProps![key]);
        if (styleFieldName) payload[styleFieldName] = settings.musicStyle.trim();
      }
      if (settings.lyrics?.trim()) {
        const lyricsFieldName = LYRICS_CANDIDATES.find((key) => liveProps![key]);
        if (lyricsFieldName) payload[lyricsFieldName] = settings.lyrics.trim();
      }
      if (typeof settings.instrumental === "boolean") {
        const instrumentalFieldName = INSTRUMENTAL_CANDIDATES.find((key) => liveProps![key]?.type === "boolean");
        if (instrumentalFieldName) payload[instrumentalFieldName] = settings.instrumental;
      }
    }
  }

  if (settings.resolution) {
    // Submit under the model's real field name when we could confirm one
    // (matches whatever the /schema route found — "resolution", "quality",
    // or another provider-specific key); fall back to "resolution" if the
    // probe failed so behavior doesn't regress for the common case.
    const resolutionFieldName = liveProps
      ? (RESOLUTION_CANDIDATES.find((key) => Array.isArray(liveProps![key]?.enum)) ?? "resolution")
      : "resolution";
    payload[resolutionFieldName] = settings.resolution;
  }

  // Real max reference-image count from the live "images_list" schema
  // field, when we probed it — falls back to the static registry value if
  // the probe failed or this model doesn't use images_list at all.
  const referenceCap = liveProps?.images_list?.maxItems ?? model.maxReferences;

  // Motion Control (e.g. Runway Act-Two, Wan Animate): character image + a
  // separate reference/motion video — a genuinely two-input shape, handled
  // first. Field names and extra params vary per model (see the
  // videoFieldName/motionSupportsPrompt/motionModeOptions doc comments on
  // ModelConfig).
  if (model.mode === "motion") {
    if (body.characterImageUrl) payload.image_url = body.characterImageUrl;
    if (body.videoUrl) payload[model.videoFieldName ?? "reference_video_url"] = body.videoUrl;
    if (!model.motionSupportsPrompt) delete payload.prompt; // most motion models don't take one
    if (model.motionModeOptions?.length) {
      payload.mode = settings.motionMode || model.defaultMotionMode;
    }
    return payload;
  }

  // Video upscaler (enhance mode, video primary input): video_url + the
  // resolution already set above + copy_audio. No prompt field in its schema.
  if (model.mode === "enhance" && model.requiresVideoInput) {
    if (body.videoUrl) payload.video_url = body.videoUrl;
    if (typeof settings.keepOriginalSound === "boolean") payload.copy_audio = settings.keepOriginalSound;
    delete payload.prompt;
    return payload;
  }

  // Edit Video (video-to-video): primary video input, optional reference
  // images ("elements") via images_list.
  if (model.mode === "v2v") {
    if (body.videoUrl) payload.video_url = body.videoUrl;
    if (body.references?.length) {
      payload.images_list = body.references.slice(0, referenceCap);
    }
    if (typeof body.settings?.keepOriginalSound === "boolean") {
      payload.keep_original_sound = body.settings.keepOriginalSound;
    }
    return payload;
  }

  // Attach reference / source images per the model's expected input shape.
  // `supportsStartEndFrame` models (dedicated "flf" mode, or an i2v model
  // whose live schema also accepts a distinct end frame — e.g. Seedance 2.0
  // VIP's 2-image start+end transition, Kling v3 4K's "last_image" field)
  // get explicit Start/End frame slots in the composer instead of the
  // generic "add as many refs" tray. Two shapes exist on muapi's side:
  // images_list = [start, end] (most models), or a separate named field for
  // the end frame alongside a single image_url for the start.
  if (model.mode === "flf" || (model.supportsStartEndFrame && model.imageInputKey === "images_list")) {
    const frames = [body.startFrameUrl, body.endFrameUrl].filter(Boolean);
    payload.images_list = frames;
  } else if (model.supportsStartEndFrame && model.endFrameFieldName) {
    if (body.startFrameUrl) payload.image_url = body.startFrameUrl;
    if (body.endFrameUrl) payload[model.endFrameFieldName] = body.endFrameUrl;
  } else if (model.imageInputKey === "images_list") {
    payload.images_list = (body.references ?? []).slice(0, referenceCap);
  } else if (model.imageInputKey === "image_url") {
    const url = body.references?.[0] || body.startFrameUrl;
    if (url) payload.image_url = url;
  }

  // Inpaint: attach the painted mask under whichever real field name the
  // live schema confirms. A `supportsMask` model with no matching candidate
  // field found is a real problem, not a "degrade gracefully" case like a
  // missing num_images field — silently omitting it would submit a normal
  // whole-image edit that ignores the mask entirely, which looks to the user
  // like the tool just didn't respect what they painted. Throwing here
  // (caught by handleGenerateRequest, surfaced as a real error) is
  // deliberately louder than this file's usual "omit and move on" pattern.
  if (body.maskUrl) {
    const maskFieldName = liveProps ? MASK_CANDIDATES.find((key) => liveProps![key]) : null;
    if (!maskFieldName) {
      throw new Error(
        `${model.label}'s live schema didn't expose a recognized mask field (checked: ${MASK_CANDIDATES.join(", ")}) — inpainting isn't confirmed working on this model yet.`
      );
    }
    payload[maskFieldName] = body.maskUrl;
  }

  // Optional secondary video reference on an i2v/omni-style model — only
  // sent when the live schema actually confirmed a matching field exists
  // (see VIDEO_REF_CANDIDATES above); otherwise silently omitted rather than
  // guessing a field name muapi doesn't recognize.
  if (wantsOptionalVideoRef && liveProps) {
    const videoFieldName = VIDEO_REF_CANDIDATES.find((key) => liveProps![key]);
    if (videoFieldName) payload[videoFieldName] = body.videoUrl;
  }

  // Topaz image upscaler — discrete 1/2/4/8x factor.
  if (model.id === "topaz-image-upscale" && settings.upscaleFactor) {
    payload.upscale_factor = settings.upscaleFactor;
  }

  // Meshy 3D — shared mesh-quality controls across all three Meshy
  // endpoints (image / multi-image / text to 3D), verified against
  // muapi's live model schemas.
  if (model.category === "3d" && model.provider === "Meshy") {
    if (settings.topology) payload.topology = settings.topology;
    if (settings.targetPolycount) payload.target_polycount = settings.targetPolycount;
    if (typeof settings.shouldRemesh === "boolean") payload.should_remesh = settings.shouldRemesh;
    if (settings.symmetryMode) payload.symmetry_mode = settings.symmetryMode;
    if (typeof settings.enablePbr === "boolean") payload.enable_pbr = settings.enablePbr;

    if (model.mode === "t23d") {
      // meshy-6-text-to-3d: no image, no should_texture/pose_mode/texture_prompt.
      if (settings.meshyMode) payload.mode = settings.meshyMode;
      if (typeof settings.enablePromptExpansion === "boolean") {
        payload.enable_prompt_expansion = settings.enablePromptExpansion;
      }
    } else {
      // meshy-6-image-to-3d / meshy-6-multi-image-to-3d
      if (typeof settings.shouldTexture === "boolean") payload.should_texture = settings.shouldTexture;
      if (settings.poseMode) payload.pose_mode = settings.poseMode;
      if (settings.texturePrompt?.trim()) payload.texture_prompt = settings.texturePrompt.trim();
    }
  }

  return payload;
}

export async function handleGenerateRequest(category: Category, request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const model = getModel(body.modelId);
  if (!model || model.category !== category) {
    return NextResponse.json({ error: "Unknown model for this category" }, { status: 400 });
  }
  // Backstop for models flagged `unavailable` in the registry (confirmed
  // broken on muapi's own side, not something a payload fix here can
  // resolve) — the picker already blocks selecting these, but this guard
  // rejects a direct API call too, before wasting a DB insert or a real
  // muapi round-trip that's guaranteed to 502.
  if (model.unavailable) {
    return NextResponse.json(
      { error: model.unavailableReason || `${model.label} is temporarily unavailable.` },
      { status: 503 }
    );
  }

  const hasVideoInput = !!body.videoUrl;
  if (!body.prompt?.trim() && !(body.references?.length) && !body.startFrameUrl && !hasVideoInput) {
    return NextResponse.json({ error: "Add a prompt or a reference image" }, { status: 400 });
  }
  if (model.mode === "v2v" && !body.videoUrl) {
    return NextResponse.json({ error: "Upload a video to edit" }, { status: 400 });
  }
  if (model.mode === "enhance" && model.requiresVideoInput && !body.videoUrl) {
    return NextResponse.json({ error: "Upload a video to upscale" }, { status: 400 });
  }
  if (model.mode === "motion" && (!body.videoUrl || !body.characterImageUrl)) {
    return NextResponse.json({ error: "Add both a motion video and a character image" }, { status: 400 });
  }
  // Static, registry-level check (no live schema needed) — catches picking
  // an unsupported model before wasting a DB insert or a muapi round-trip.
  if (body.maskUrl && !model.supportsMask) {
    return NextResponse.json(
      { error: `${model.label} doesn't support masked inpainting — try Nano Banana 2 Edit, Nano Banana Pro Edit, or GPT Image 2 Edit.` },
      { status: 400 }
    );
  }

  // externalProvider models (currently just Photoroom's background remover)
  // aren't a muapi endpoint at all — buildPayload's muapi-shape logic (and
  // its live schema probe) doesn't apply and would just be wasted/wrong work.
  let payload: Record<string, unknown>;
  try {
    payload = model.externalProvider ? {} : await buildPayload(model, body);
  } catch (err) {
    // buildPayload only throws for the mask-field-not-found case above —
    // everything else it handles by omitting the field, matching this
    // route's usual behavior.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to build request" }, { status: 400 });
  }
  const costUsd = estimateCostUSD(model, {
    numImages: body.settings?.numImages,
    duration: body.settings?.duration,
    resolution: body.settings?.resolution,
  });

  // 1. Create the row immediately so the gallery can show a live "queued" card.
  const { data: row, error: insertError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      category,
      mode: model.mode,
      model_id: model.id,
      model_label: model.label,
      endpoint: model.endpoint,
      prompt: body.prompt ?? "",
      reference_urls: body.references ?? [],
      start_frame_url: body.startFrameUrl ?? body.videoUrl ?? null,
      end_frame_url: body.endFrameUrl ?? body.characterImageUrl ?? null,
      settings: body.settings ?? {},
      status: "queued",
      cost_usd: costUsd,
      project_id: body.projectId ?? null,
      tool_id: body.toolId ?? null,
    })
    .select()
    .single();

  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message || "Failed to create generation" }, { status: 500 });
  }

  // 2a. externalProvider models bypass muapi entirely — currently just
  //     Photoroom's Remove Background API, a single synchronous call that
  //     returns image bytes directly (no request_id/poll). Upload the
  //     result to our own "media" bucket (same public bucket reference
  //     uploads already use) and mark the row completed in one shot — the
  //     client's existing pollUntilDone against /api/jobs/[id] just sees
  //     "completed" on its first poll, so no client changes were needed.
  if (model.externalProvider === "photoroom") {
    const sourceUrl = body.references?.[0] || body.startFrameUrl;
    if (!sourceUrl) {
      await supabase
        .from("generations")
        .update({ status: "failed", error: "No source image provided" })
        .eq("id", row.id);
      return NextResponse.json({ error: "No source image provided" }, { status: 400 });
    }
    try {
      const pngBytes = await removeBackgroundPhotoroom(sourceUrl);
      const path = `${user.id}/bg-removed-${Date.now()}-${nanoid(6)}.png`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, pngBytes, { contentType: "image/png", upsert: false });
      if (uploadError) throw new PhotoroomError(uploadError.message, 500);

      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const outputUrl = pub.publicUrl;

      const { data: updated } = await supabase
        .from("generations")
        .update({ status: "completed", output_urls: [outputUrl], thumbnail_url: outputUrl })
        .eq("id", row.id)
        .select()
        .single();

      return NextResponse.json(updated ?? row);
    } catch (err) {
      const message = err instanceof PhotoroomError ? err.message : "Photoroom request failed";
      console.error(
        `[generate:${category}] Photoroom submit failed model=${model.id} status=${
          err instanceof PhotoroomError ? err.status : "n/a"
        } message=${message}`
      );
      await supabase.from("generations").update({ status: "failed", error: message }).eq("id", row.id);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // 2b. Fire the muapi job. Never block the response on completion — the
  //    client polls /api/jobs/[id] for status so the user can keep working.
  //    `submitEndpoint` overrides `endpoint` for the handful of models
  //    (currently the ByteDance Seedream 5.0 family + v4 Edit) whose real
  //    POST route drops the "bytedance-" provider prefix that the GET
  //    catalog/schema lookup requires — see ModelConfig.submitEndpoint.
  try {
    const submitted = await submitJob(model.submitEndpoint ?? model.endpoint, payload);
    const requestId = (submitted.request_id || submitted.id) as string | undefined;
    const status = submitted.status === "completed" ? "completed" : "processing";

    const update: Record<string, unknown> = { status, request_id: requestId ?? null };
    if (status === "completed") {
      const outputs = extractOutputUrls(submitted as never);
      update.output_urls = outputs;
      update.thumbnail_url = outputs[0] ?? null;
    }

    const { data: updated } = await supabase
      .from("generations")
      .update(update)
      .eq("id", row.id)
      .select()
      .single();

    return NextResponse.json(updated ?? row);
  } catch (err) {
    const message = err instanceof MuapiError ? err.message : "muapi request failed";
    // Log the full failure server-side — previously this only ever reached
    // the client's error toast, so diagnosing a submit failure meant asking
    // the user for a screenshot every time. With this, `get_runtime_logs` /
    // `get_runtime_errors` on the Vercel project surfaces the model, the
    // exact endpoint slug we posted to, and muapi's raw status + response
    // body directly.
    console.error(
      `[generate:${category}] muapi submit failed model=${model.id} endpoint=${model.endpoint} status=${
        err instanceof MuapiError ? err.status : "n/a"
      } message=${message}`
    );
    await supabase.from("generations").update({ status: "failed", error: message }).eq("id", row.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
