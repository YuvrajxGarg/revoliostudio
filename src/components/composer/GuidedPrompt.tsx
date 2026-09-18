"use client";

import { useState } from "react";
import { Clapperboard, ImageIcon, Layers3 } from "lucide-react";
import type { Category } from "@/lib/models";
import { cn } from "@/lib/utils";

type Guide = "still" | "character" | "shot";
type Field = "subject" | "setting" | "action" | "camera" | "look" | "sound" | "avoid";

const LIMIT = 2000;
const FIELDS: Record<Guide, { key: Field; label: string; hint: string }[]> = {
  still: [
    { key: "subject", label: "Subject", hint: "Who or what should be visible?" },
    { key: "setting", label: "Setting", hint: "Where is it, and what is around it?" },
    { key: "camera", label: "Framing", hint: "Close-up, wide shot, angle, lens…" },
    { key: "look", label: "Visual direction", hint: "Lighting, palette, texture, mood…" },
    { key: "avoid", label: "Keep out", hint: "Only add constraints you actually need" },
  ],
  character: [
    { key: "subject", label: "Character", hint: "Age, appearance, clothing, defining details…" },
    { key: "look", label: "Shared look", hint: "Lighting, background, palette, texture…" },
    { key: "camera", label: "Views", hint: "E.g. portrait, full-body front, full-body back" },
    { key: "avoid", label: "Keep consistent", hint: "E.g. face, outfit, proportions" },
  ],
  shot: [
    { key: "subject", label: "Subject", hint: "Who or what is in the shot?" },
    { key: "setting", label: "Setting", hint: "Place, time of day, atmosphere…" },
    { key: "action", label: "Action over time", hint: "What happens from opening to end?" },
    { key: "camera", label: "Camera path", hint: "Starting frame, movement, ending frame…" },
    { key: "look", label: "Visual direction", hint: "Lighting, palette, lens, mood…" },
    { key: "sound", label: "Sound", hint: "Ambience, dialogue, music, or silence…" },
    { key: "avoid", label: "Keep out", hint: "E.g. captions, cuts, extra people" },
  ],
};

function compose(guide: Guide, values: Record<Field, string>): string {
  const v = (key: Field) => values[key].trim().replace(/\s+/g, " ");
  if (guide === "character") {
    return [
      `Character reference sheet of ${v("subject")}.`,
      v("camera") ? `Show ${v("camera")} as distinct views of the same character.` : "Show a portrait, full-body front view, and full-body back view of the same character.",
      v("look") && `Use the same ${v("look")} across every view.`,
      v("avoid") && `Keep ${v("avoid")} consistent across every view.`,
    ].filter(Boolean).join(" ");
  }
  if (guide === "shot") {
    return [
      `Single continuous shot of ${v("subject")}${v("setting") ? ` in ${v("setting")}` : ""}.`,
      v("action") && `Action: ${v("action")}.`,
      v("camera") && `Camera: ${v("camera")}.`,
      v("look") && `Visual direction: ${v("look")}.`,
      v("sound") && `Sound: ${v("sound")}.`,
      v("avoid") && `Avoid ${v("avoid")}.`,
    ].filter(Boolean).join(" ");
  }
  return [
    `${v("subject")}${v("setting") ? ` in ${v("setting")}` : ""}.`,
    v("camera") && `Composition: ${v("camera")}.`,
    v("look") && `Visual direction: ${v("look")}.`,
    v("avoid") && `Avoid ${v("avoid")}.`,
  ].filter(Boolean).join(" ");
}

export function GuidedPrompt({ category, draft, onUse }: {
  category: Category;
  draft: string;
  onUse: (prompt: string) => void;
}) {
  const [guide, setGuide] = useState<Guide>(category === "video" ? "shot" : "still");
  const [values, setValues] = useState<Record<Field, string>>({
    subject: "", setting: "", action: "", camera: "", look: "", sound: "", avoid: "",
  });
  const [error, setError] = useState("");
  const options: { id: Guide; label: string; icon: typeof ImageIcon }[] = category === "video"
    ? [{ id: "shot", label: "Directed shot", icon: Clapperboard }]
    : [
        { id: "still", label: "Image", icon: ImageIcon },
        { id: "character", label: "Character sheet", icon: Layers3 },
      ];

  function usePrompt() {
    const subject = values.subject.trim() || draft.trim();
    if (!subject) {
      setError("Add a subject or write a draft first.");
      return;
    }
    const next = compose(guide, { ...values, subject });
    if (next.length > LIMIT) {
      setError(`This prompt is ${next.length} characters. Shorten the fields to fit ${LIMIT}.`);
      return;
    }
    setError("");
    onUse(next);
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      <div>
        <h3 className="font-semibold">Build a detailed prompt</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">Give each part of the scene a job. Fill only what matters, then review the result on the left before applying it.</p>
      </div>
      <div className="flex gap-2">
        {options.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => { setGuide(id); setError(""); }}
            className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium", guide === id ? "border-accent bg-accent/10 text-accent" : "border-border-subtle bg-surface-2 text-muted hover:text-foreground")}
            aria-pressed={guide === id}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {FIELDS[guide].map(({ key, label, hint }) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-medium">{label}</span>
            <textarea value={values[key]} onChange={(e) => setValues((old) => ({ ...old, [key]: e.target.value }))}
              placeholder={hint} rows={key === "action" ? 2 : 1}
              className="w-full resize-y rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs outline-none focus:border-accent/60" />
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
      <button type="button" onClick={usePrompt} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-2">
        Use in editor
      </button>
      <p className="text-[11px] leading-relaxed text-muted">Your attached references stay attached. This guide changes only the prompt text.</p>
    </div>
  );
}
