import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleGenerateRequest } from "@/lib/generate";
import { getThumbnailModelFamily } from "@/lib/thumbnailModels";
import {
  buildThumbnailPrompt,
  resolveThumbnailReferences,
  type ThumbnailCharacterInput,
  type SceneImageSource,
} from "@/lib/thumbnailPrompt";
import { SCENE_CATEGORIES, type EmotionPresetId, type SceneCategoryId } from "@/lib/thumbnailPresets";

export const runtime = "nodejs";

const TOOL_ID = "thumbnail";

interface CharacterBody {
  photoUrl?: string;
  emotionPresetId?: EmotionPresetId;
  emotionCustom?: string;
}

interface RequestBody {
  frameLayout?: "single" | "split";
  aspectRatio?: string;
  characters?: CharacterBody[];
  subjectActionPose?: string;
  keyElements?: string;
  location?: string;
  composition?: string;
  backgroundTreatment?: string;
  /** Optional per-category reference photo (e.g. a real product shot for
   * "Key elements", a real photo of the actual location) — keyed by
   * SceneCategoryId, only present for categories the user actually uploaded
   * one for. */
  sceneImages?: Partial<Record<SceneCategoryId, string>>;
  rimLightColorId?: string;
  bakedText?: string | null;
  numVariations?: number;
  /** The originally-uploaded reference thumbnail (if any) — attached as a
   * loose layout/mood guide, lowest priority when the 4-image budget is
   * tight. See resolveThumbnailReferences. */
  referenceImageUrl?: string | null;
  /**
   * The (possibly user-edited) prompt shown in the Render step's preview.
   * Client always computes a default via buildThumbnailPrompt and lets the
   * user tweak it before submitting — sent verbatim here rather than
   * rebuilt server-side, so an edit actually takes effect. Falls back to
   * rebuilding from the structured fields if omitted (e.g. a direct API
   * call bypassing the UI).
   */
  prompt?: string;
  projectId?: string | null;
  modelFamily?: string;
}

const CATEGORY_TEXT: Record<SceneCategoryId, keyof RequestBody> = {
  subjectActionPose: "subjectActionPose",
  keyElements: "keyElements",
  location: "location",
  composition: "composition",
  backgroundTreatment: "backgroundTreatment",
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.subjectActionPose?.trim()) {
    return NextResponse.json({ error: "Subject action and pose is required" }, { status: 400 });
  }
  if (!body.location?.trim()) {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }

  const characters = body.characters ?? [];
  const missingPhoto = characters.find((c) => !c.photoUrl?.trim());
  if (missingPhoto) {
    return NextResponse.json({ error: "Every character needs a face photo" }, { status: 400 });
  }

  const characterInputs: ThumbnailCharacterInput[] = characters.map((c) => ({
    emotionPresetId: c.emotionPresetId ?? "charismatic_calm",
    emotionCustom: c.emotionCustom,
  }));

  // Scene element images, in the same canonical category order used
  // everywhere else — only categories the user actually attached a photo to.
  const sceneImages: SceneImageSource[] = SCENE_CATEGORIES.filter((cat) => body.sceneImages?.[cat.id]?.trim()).map(
    (cat) => ({
      categoryLabel: cat.label,
      description: (body[CATEGORY_TEXT[cat.id]] as string | undefined)?.trim() ?? "",
      imageUrl: body.sceneImages![cat.id]!.trim(),
    })
  );

  const referenceImageUrl = body.referenceImageUrl?.trim() || null;

  const resolved = resolveThumbnailReferences({
    characterPhotoUrls: characters.map((c) => c.photoUrl!),
    sceneImages,
    layoutReferenceUrl: referenceImageUrl,
  });

  const prompt =
    body.prompt?.trim() ||
    buildThumbnailPrompt({
      frameLayout: body.frameLayout ?? "single",
      aspectRatio: body.aspectRatio ?? "16:9",
      characters: characterInputs,
      sceneImageRefs: resolved.sceneImageRefs,
      subjectActionPose: body.subjectActionPose,
      keyElements: body.keyElements,
      location: body.location,
      composition: body.composition,
      backgroundTreatment: body.backgroundTreatment,
      rimLightColorId: body.rimLightColorId ?? "classic_white",
      bakedText: body.bakedText,
      hasLayoutReference: resolved.hasLayoutReference,
    });

  const family = getThumbnailModelFamily(body.modelFamily);
  const modelId = resolved.urls.length > 0 ? family.editModelId : family.t2iModelId;

  const numVariations = Math.max(1, Math.min(4, Math.round(body.numVariations ?? 1)));

  // Reuse the exact same insert/submit/poll logic every other studio uses
  // (cost tracking, gallery scoping via toolId, error handling) rather than
  // duplicating it — cookies() reads from the ambient request context, so
  // this synthetic Request still carries the real caller's session.
  const syntheticRequest = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId,
      prompt,
      references: resolved.urls,
      settings: { aspectRatio: body.aspectRatio ?? "16:9", numImages: numVariations },
      toolId: TOOL_ID,
      projectId: body.projectId ?? null,
    }),
  });

  return handleGenerateRequest("image", syntheticRequest);
}
