import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatAboutPrompt, randomPrompt, autoPrompt, imageToPrompt, suggestVariation, PromptAssistError } from "@/lib/promptAssist";
import type { VaryCandidateModel } from "@/lib/promptAssist";
import type { Category } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body =
  | { action: "chat"; category: Category; draft?: string; message: string; history?: { role: "user" | "assistant"; text: string }[] }
  | { action: "random"; category: Category }
  | { action: "auto"; category: Category; draft?: string }
  | { action: "image-to-prompt"; category: Category; imageUrl: string }
  | { action: "vary"; category: Category; draft?: string; currentModelLabel?: string; candidates?: VaryCandidateModel[] };

/** Backs the Prompt editor flyout (PromptEditorModal.tsx) — chat/random/auto/image-to-prompt, one shared route since they're all thin wrappers around the same muapi LLM call. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "chat": {
        if (!body.message?.trim()) {
          return NextResponse.json({ error: "Type a message first" }, { status: 400 });
        }
        const reply = await chatAboutPrompt({
          category: body.category,
          draft: body.draft ?? "",
          history: body.history ?? [],
          message: body.message,
        });
        return NextResponse.json({ reply });
      }
      case "random": {
        const prompt = await randomPrompt(body.category);
        return NextResponse.json({ prompt });
      }
      case "auto": {
        const prompt = await autoPrompt(body.category, body.draft ?? "");
        return NextResponse.json({ prompt });
      }
      case "image-to-prompt": {
        if (!body.imageUrl) {
          return NextResponse.json({ error: "No reference image selected" }, { status: 400 });
        }
        const prompt = await imageToPrompt(body.category, body.imageUrl);
        return NextResponse.json({ prompt });
      }
      case "vary": {
        const suggestion = await suggestVariation({
          category: body.category,
          draft: body.draft ?? "",
          currentModelLabel: body.currentModelLabel ?? "the current model",
          // Cap the candidate list so a huge category (Image has dozens of
          // models) doesn't blow up the prompt — the first handful is plenty
          // for the model to pick a sensible alternative from.
          candidates: (body.candidates ?? []).slice(0, 12),
        });
        return NextResponse.json({ suggestion });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof PromptAssistError ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
