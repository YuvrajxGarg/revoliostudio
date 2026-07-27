"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { useComposerStore } from "@/store/composerStore";
import { useTemplates } from "@/hooks/useTemplates";
import type { Category } from "@/lib/models";

/** Small "Save template" action for a studio panel header. */
export function SaveTemplateButton({ category }: { category: Category }) {
  const { modelId, prompt, settings, references } = useComposerStore();
  const { saveTemplate } = useTemplates(category);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!modelId || !name.trim()) return;
    await saveTemplate({
      name: name.trim(),
      modelId,
      prompt,
      settings,
      referenceUrls: references.map((r) => r.url),
    });
    setOpen(false);
    setName("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Save the current setup as a reusable template"
        className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] text-muted hover:text-foreground transition-colors"
      >
        {saved ? <Check className="h-3 w-3 text-accent" /> : <Bookmark className="h-3 w-3" />}
        {saved ? "Saved" : "Template"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border-subtle bg-surface p-2 shadow-2xl">
          <div className="panel-label pb-1.5">Save current setup</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Template name…"
            className="w-full rounded-lg bg-surface-2 px-2 py-1.5 text-xs outline-none placeholder:text-muted"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim() || !modelId}
            className="mt-2 w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-2"
          >
            Save template
          </button>
        </div>
      )}
    </div>
  );
}
