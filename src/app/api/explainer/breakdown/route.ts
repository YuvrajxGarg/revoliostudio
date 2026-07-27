import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateJson, GeminiError } from "@/lib/gemini";
import { MAX_SHOTS } from "@/lib/explainerPresets";

export const runtime = "nodejs";

// Same reasoning as Thumbnail Generator's analysis call: this is a genuine
// "read the material and think in shots" reasoning task, not a quick
// completion — claude-sonnet-5 is the model whose own catalog description
// calls out multimodal analysis/reasoning strength, so it's worth the extra
// latency over the cheap/fast chat default.
const BREAKDOWN_LLM_MODEL = "claude-sonnet-5";

export interface ExplainerShot {
  caption: string;
  visual: string;
  durationSeconds: number;
}

export interface ExplainerBreakdown {
  title: string;
  shots: ExplainerShot[];
}

interface RawShot {
  caption?: string;
  visual?: string;
  durationSeconds?: number;
}

interface RawBreakdown {
  title?: string;
  shots?: RawShot[];
}

const SYSTEM_INSTRUCTION = `You are a motion-graphics explainer-video director. You take a script or a rough topic and break it into an ordered shot-by-shot storyboard for a motion-graphics explainer video (think: SaaS product explainers, educational breakdowns, Kurzgesagt-style videos) — never live-action, never photoreal.

If the input reads like a rough topic or outline rather than a full narration script, first mentally expand it into a clear, coherent explainer narrative, then break THAT into shots — don't just restate the topic once.

Return:
- title: a short title for this explainer (a few words).
- shots: an ordered array, typically 6-14 shots but use as many as the content genuinely needs (never more than ${MAX_SHOTS}). Each shot has:
  - caption: the short on-screen text/voiceover line for this shot — plain, concise, under 20 words. This is what's said or shown as text during this beat, not a description of the artwork.
  - visual: a concrete, SPECIFIC description of what's actually on screen as a still motion-graphics frame — name the actual icons, diagrams, labeled parts, illustrated metaphors, or animated-text treatment that best convey this beat (e.g. "a rocket icon lifts off from a stack of three coins, dotted arc trail behind it, a small upward trend-line graph in the corner" — not vague filler like "a nice graphic about growth"). Never describe real photography or live-action footage.
  - durationSeconds: a rough pacing estimate for this shot, typically 2-6.

Keep shots visually varied — don't repeat the same icon/metaphor twice in a row — and make sure the sequence actually tells the story in order, building on what came before.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caption: { type: "string" },
          visual: { type: "string" },
          durationSeconds: { type: "number" },
        },
        required: ["caption", "visual"],
      },
    },
  },
  required: ["title", "shots"],
};

function sanitize(raw: RawBreakdown): ExplainerBreakdown {
  const shots = (raw.shots ?? [])
    .map((s): ExplainerShot => ({
      caption: s.caption?.trim() || "",
      visual: s.visual?.trim() || "",
      durationSeconds: Number.isFinite(Number(s.durationSeconds)) && Number(s.durationSeconds) > 0 ? Number(s.durationSeconds) : 3,
    }))
    .filter((s) => s.caption || s.visual)
    .slice(0, MAX_SHOTS);

  return {
    title: raw.title?.trim() || "Untitled explainer",
    shots: shots.length > 0 ? shots : [{ caption: "", visual: "", durationSeconds: 3 }],
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { script?: string; styleReferenceUrl?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const script = body.script?.trim();
  if (!script) return NextResponse.json({ error: "Paste a script or topic first" }, { status: 400 });

  const styleReferenceUrl = body.styleReferenceUrl?.trim() || null;
  const prompt = styleReferenceUrl
    ? `Break this down into a shot-by-shot storyboard. A style/design reference image is attached for visual grounding — let your shot descriptions naturally fit a similar visual world (motifs, level of detail), but don't describe the reference image itself as a shot.\n\nSCRIPT / TOPIC:\n${script}`
    : `Break this down into a shot-by-shot storyboard.\n\nSCRIPT / TOPIC:\n${script}`;

  // One retry on a different model before giving up — a single malformed
  // response shouldn't dead-end the tool (same pattern as Thumbnail
  // Generator's analyze route, including the extractJsonPayload robustness
  // this reuses at the gemini.ts layer).
  const attempts = [BREAKDOWN_LLM_MODEL, "gemini-2-5-pro"];
  let lastError: unknown;

  for (const model of attempts) {
    try {
      const raw = await generateJson<RawBreakdown>({
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        responseSchema: RESPONSE_SCHEMA,
        imageUrl: styleReferenceUrl,
      });
      return NextResponse.json(sanitize(raw));
    } catch (err) {
      lastError = err;
    }
  }

  const message = lastError instanceof GeminiError ? lastError.message : "Breakdown failed";
  return NextResponse.json({ error: message }, { status: 502 });
}
