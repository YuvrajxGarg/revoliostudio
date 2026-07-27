import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getModel } from "@/lib/models";
import { getModelSchema, MuapiError } from "@/lib/muapi";
import type { ModelSchemaInfo } from "@/lib/model-schema-types";

export const runtime = "nodejs";

// Cache resolved schema info in-memory per server instance — schemas are
// static enough that re-fetching muapi on every model switch is wasteful.
const cache = new Map<string, { info: ModelSchemaInfo; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const model = getModel(id);
  if (!model) return NextResponse.json({ error: "Unknown model" }, { status: 404 });

  const cached = cache.get(model.endpoint);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.info);
  }

  const empty: ModelSchemaInfo = {
    resolutions: null,
    defaultResolution: null,
    resolutionField: null,
    duration: null,
    numImagesField: null,
    maxNumImages: null,
    audioField: null,
    defaultAudio: null,
    maxReferenceImages: null,
    styleField: null,
    lyricsField: null,
    instrumentalField: null,
    videoReferenceField: null,
  };

  // Candidate field names to check against the live schema, in priority
  // order — muapi doesn't standardize these across providers. The original
  // 5-name list missed several real model schemas (the batch-size control
  // was silently disappearing for models that do support it), so this is
  // widened the same way RESOLUTION_CANDIDATES already is below.
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
  // "resolution"/"quality" alone missed several real video-model schemas
  // that expose the same concept under a different key (e.g. Seedance-style
  // "output_resolution", some providers' "video_quality"/"size") — widen
  // the search the same way num-images/audio already do, and only accept a
  // field that actually has a discrete enum (no enum = nothing to pick from).
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
  // Audio (t2a) candidates — same "probe several plausible names, use
  // whichever actually exists" approach as the lists above, since Suno and
  // MMAudio's real schemas weren't available to verify directly (see the
  // doc comment on the `audio` section of models.ts).
  const STYLE_CANDIDATES = ["style", "tags", "genre", "music_style"];
  const LYRICS_CANDIDATES = ["lyrics", "custom_lyrics", "lyric"];
  const INSTRUMENTAL_CANDIDATES = ["instrumental", "make_instrumental", "is_instrumental"];
  // Optional secondary video-reference field on an otherwise image-based
  // (i2v/omni) model — e.g. a character-replace-style workflow that takes
  // one image reference plus one motion/scene video. Only meaningful for
  // models that aren't already a dedicated v2v/motion/enhance composer
  // (those have their own primary video field and never read this).
  const VIDEO_REF_CANDIDATES = ["video_url", "reference_video_url", "source_video_url", "input_video", "video"];

  try {
    const schema = await getModelSchema(model.endpoint);
    const props = schema.input_schema?.schemas?.input_data?.properties ?? {};

    const resolutionFieldName =
      RESOLUTION_CANDIDATES.find((key) => Array.isArray(props[key]?.enum) && props[key]!.enum!.length > 0) ?? null;
    const resolutionField = resolutionFieldName ? props[resolutionFieldName] : undefined;
    const durationField = props.duration;

    const numImagesFieldName = NUM_IMAGES_CANDIDATES.find((key) => props[key]) ?? null;
    const numImagesField = numImagesFieldName ? props[numImagesFieldName] : undefined;

    const audioFieldName = AUDIO_CANDIDATES.find((key) => props[key]?.type === "boolean") ?? null;
    const audioField = audioFieldName ? props[audioFieldName] : undefined;

    const styleFieldName = STYLE_CANDIDATES.find((key) => props[key]) ?? null;
    const lyricsFieldName = LYRICS_CANDIDATES.find((key) => props[key]) ?? null;
    const instrumentalFieldName =
      INSTRUMENTAL_CANDIDATES.find((key) => props[key]?.type === "boolean") ?? null;
    // Only surface this for non-motion/v2v/enhance modes — those already
    // have a dedicated primary video field via a different composer
    // entirely, and treating it as an *optional secondary* one here would
    // be wrong (and, for v2v, would collide with the required video input).
    const videoReferenceFieldName =
      model.mode === "motion" || model.mode === "v2v" || (model.mode === "enhance" && model.requiresVideoInput)
        ? null
        : (VIDEO_REF_CANDIDATES.find((key) => props[key]) ?? null);

    const info: ModelSchemaInfo = {
      resolutions: resolutionField?.enum ?? null,
      defaultResolution: (resolutionField?.default as string) ?? resolutionField?.enum?.[0] ?? null,
      resolutionField: resolutionFieldName,
      duration:
        durationField?.minValue != null && durationField?.maxValue != null
          ? {
              min: durationField.minValue,
              max: durationField.maxValue,
              step: durationField.step ?? 1,
              default: (durationField.default as number) ?? durationField.minValue,
            }
          : null,
      numImagesField: numImagesFieldName,
      maxNumImages: numImagesField?.maxValue ?? null,
      audioField: audioFieldName,
      defaultAudio: audioFieldName ? ((audioField?.default as boolean) ?? true) : null,
      // Real muapi model schemas commonly expose a multi-image field named
      // "images_list" with a maxItems constraint — this is the ground truth
      // for how many reference images a model actually accepts, which can
      // differ from (and correct) our static registry's maxReferences.
      maxReferenceImages: (props.images_list?.maxItems as number) ?? null,
      styleField: styleFieldName,
      lyricsField: lyricsFieldName,
      instrumentalField: instrumentalFieldName,
      videoReferenceField: videoReferenceFieldName,
    };

    cache.set(model.endpoint, { info, at: Date.now() });
    return NextResponse.json(info);
  } catch (err) {
    // Schema introspection is a nice-to-have — fall back to the model's
    // static config (fixed dropdown) rather than breaking the composer.
    const message = err instanceof MuapiError ? err.message : "Failed to fetch model schema";
    return NextResponse.json({ ...empty, error: message });
  }
}
