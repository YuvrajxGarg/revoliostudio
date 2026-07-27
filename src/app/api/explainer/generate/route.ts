import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleGenerateRequest } from "@/lib/generate";
import { getModel } from "@/lib/models";
// Reused as-is — despite the filename, this is just "our roster of
// selectable t2i/i2i image model families," nothing thumbnail-specific
// about the type or the two model ids it maps to per family.
import { getThumbnailModelFamily } from "@/lib/thumbnailModels";
import { buildExplainerShotPrompt, resolveExplainerStyleReferences } from "@/lib/explainerPrompt";

export const runtime = "nodejs";

const TOOL_ID = "explainer";

interface RequestBody {
  visual?: string;
  caption?: string;
  bakeCaption?: boolean;
  styleId?: string;
  styleCustom?: string;
  aspectRatio?: string;
  /** Shared across every shot in a storyboard — see resolveExplainerStyleReferences. */
  styleReferenceUrls?: string[];
  modelFamily?: string;
  numVariations?: number;
  /**
   * The (possibly user-edited) prompt shown in the Render step's preview —
   * sent verbatim here rather than rebuilt server-side, same reasoning as
   * Thumbnail Generator's generate route. Falls back to rebuilding from the
   * structured fields if omitted.
   */
  prompt?: string;
  projectId?: string | null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.visual?.trim() && !body.prompt?.trim()) {
    return NextResponse.json({ error: "This shot needs a visual description" }, { status: 400 });
  }

  const family = getThumbnailModelFamily(body.modelFamily);
  const maxReferences = getModel(family.editModelId)?.maxReferences ?? 4;
  const styleReferenceUrls = resolveExplainerStyleReferences(body.styleReferenceUrls ?? [], maxReferences);

  const prompt =
    body.prompt?.trim() ||
    buildExplainerShotPrompt({
      visual: body.visual ?? "",
      caption: body.caption ?? "",
      bakeCaption: !!body.bakeCaption,
      styleId: body.styleId ?? "flat_vector",
      styleCustom: body.styleCustom,
      aspectRatio: body.aspectRatio ?? "16:9",
      styleReferenceCount: styleReferenceUrls.length,
    });

  const modelId = styleReferenceUrls.length > 0 ? family.editModelId : family.t2iModelId;
  const numVariations = Math.max(1, Math.min(4, Math.round(body.numVariations ?? 1)));

  // Reuse the exact same insert/submit/poll logic every other studio uses —
  // see Thumbnail Generator's /api/thumbnail/generate route for the fuller
  // explanation of why a synthetic Request is safe here (cookies() reads
  // from the ambient request context, not this Request object).
  const syntheticRequest = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId,
      prompt,
      references: styleReferenceUrls,
      settings: { aspectRatio: body.aspectRatio ?? "16:9", numImages: numVariations },
      toolId: TOOL_ID,
      projectId: body.projectId ?? null,
    }),
  });

  return handleGenerateRequest("image", syntheticRequest);
}
