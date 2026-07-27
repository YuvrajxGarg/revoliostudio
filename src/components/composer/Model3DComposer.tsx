"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useComposerStore } from "@/store/composerStore";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { getModel } from "@/lib/models";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";

function pickMeshyModelId(numImages: number): string {
  if (numImages === 0) return "meshy-text-to-3d";
  if (numImages === 1) return "meshy-image-to-3d";
  return "meshy-multi-image-to-3d";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-xs text-muted">
        <span>{label}</span>
        {hint && (
          <span title={hint}>
            <Info className="h-3 w-3 opacity-60" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Model3DComposer({ onGenerated }: { onGenerated?: () => void }) {
  const {
    prompt,
    references,
    settings,
    isSubmitting,
    setCategory,
    setPrompt,
    addReference,
    removeReference,
    updateSettings,
    setSubmitting,
    resetAfterSubmit,
  } = useComposerStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCategory("3d"), [setCategory]);

  const modelId = pickMeshyModelId(references.length);
  const model = getModel(modelId);
  const hasImages = references.length > 0;

  const topology = settings.topology ?? "triangle";
  const targetPolycount = settings.targetPolycount ?? 30000;
  const shouldRemesh = settings.shouldRemesh ?? true;
  const symmetryMode = settings.symmetryMode ?? "auto";
  const enablePbr = settings.enablePbr ?? false;
  const poseMode = settings.poseMode ?? "";
  const shouldTexture = settings.shouldTexture ?? true;
  const meshyMode = settings.meshyMode ?? "full";
  const enablePromptExpansion = settings.enablePromptExpansion ?? false;
  const enableSafetyChecker = settings.enableSafetyChecker ?? true;

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0.5;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const cap = model?.maxReferences ?? 4;
        if (useComposerStore.getState().references.length >= cap) break;
        try {
          const { url } = await uploadReferenceFile(file);
          addReference(url, undefined, cap);
        } catch (err) {
          // Used to fail silently on e.g. an oversized image — nothing was
          // added and there was no indication why. Surface the real error
          // (like the size cap) instead.
          setError(err instanceof Error ? err.message : "Failed to upload image");
        }
      }
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    resetAfterSubmit();
    setError(null);
  }

  async function handleSubmit() {
    if (isSubmitting || !model) return;
    if (!hasImages && !prompt.trim()) {
      setError("Add a prompt or attach at least one reference image");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate/3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt,
          references: references.map((r) => r.url),
          settings,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      // Deliberately not clearing prompt/references here — keeping them in
      // the box lets the user regenerate the same setup or tweak it (e.g.
      // swap model) without retyping everything.
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Prompt" hint={hasImages ? "Optional when reference images are attached" : "Describe the object to generate"}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cyberpunk frog DJ wearing neon headphones…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted outline-none"
        />
      </Field>

      <Field label={`Image URLs ${hasImages ? "" : "(optional)"}`} hint={`1-${model?.maxReferences ?? 4} reference images from different angles`}>
        <div className="grid grid-cols-4 gap-2">
          {references.map((ref) => (
            <div key={ref.id} className="relative aspect-square rounded-lg overflow-hidden border border-border-subtle group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
              <button
                onClick={() => removeReference(ref.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}
          {references.length < (model?.maxReferences ?? 4) && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border-subtle flex flex-col items-center justify-center gap-1 text-muted hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="text-[10px]">Add</span>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="text-[11px] text-muted">{references.length}/{model?.maxReferences ?? 4} items</span>
      </Field>

      {hasImages && (
        <Field label="Generate Texture" hint="Generate textures alongside the mesh.">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Adds a textured material pass</span>
            <Toggle checked={shouldTexture} onChange={(v) => updateSettings({ shouldTexture: v })} />
          </div>
        </Field>
      )}

      <Field label="Topology" hint="Output mesh topology.">
        <Dropdown
          fullWidth
          value={topology}
          options={[
            { value: "triangle", label: "Triangle" },
            { value: "quad", label: "Quad" },
          ]}
          onChange={(v) => updateSettings({ topology: v as "triangle" | "quad" })}
        />
      </Field>

      <Field label="Target Polygon Count" hint="100 – 300,000">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={100}
            max={300000}
            step={1000}
            value={targetPolycount}
            onChange={(e) => updateSettings({ targetPolycount: Number(e.target.value) })}
            className="flex-1  slider-thin"
          />
          <span className="w-16 shrink-0 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-right text-xs tabular-nums">
            {targetPolycount}
          </span>
        </div>
      </Field>

      <Field label="Remesh" hint="Enable remesh phase.">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Cleans up topology after generation</span>
          <Toggle checked={shouldRemesh} onChange={(v) => updateSettings({ shouldRemesh: v })} />
        </div>
      </Field>

      <Field label="Symmetry" hint="Symmetry detection mode.">
        <Dropdown
          fullWidth
          value={symmetryMode}
          options={[
            { value: "off", label: "Off" },
            { value: "auto", label: "Auto" },
            { value: "on", label: "On" },
          ]}
          onChange={(v) => updateSettings({ symmetryMode: v as "off" | "auto" | "on" })}
        />
      </Field>

      <Field label="Enable PBR" hint="Generate PBR maps.">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Physically-based material maps</span>
          <Toggle checked={enablePbr} onChange={(v) => updateSettings({ enablePbr: v })} />
        </div>
      </Field>

      {hasImages ? (
        <>
          <Field label="Pose Mode" hint="Force humanoid characters into a standard pose.">
            <Dropdown
              fullWidth
              value={poseMode}
              options={[
                { value: "", label: "None" },
                { value: "a-pose", label: "A-Pose" },
                { value: "t-pose", label: "T-Pose" },
              ]}
              onChange={(v) => updateSettings({ poseMode: v as "" | "a-pose" | "t-pose" })}
            />
          </Field>

          <Field label="Texture Prompt" hint="Optional text to guide the texturing pass.">
            <textarea
              value={settings.texturePrompt ?? ""}
              onChange={(e) => updateSettings({ texturePrompt: e.target.value })}
              placeholder="weathered metal with rust accents"
              rows={2}
              className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted outline-none"
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Mode" hint="Preview is faster/cheaper, full produces final quality.">
            <Dropdown
              fullWidth
              value={meshyMode}
              options={[
                { value: "preview", label: "Preview" },
                { value: "full", label: "Full" },
              ]}
              onChange={(v) => updateSettings({ meshyMode: v as "preview" | "full" })}
            />
          </Field>

          <Field label="Expand Prompt" hint="Automatically enrich the prompt for more detail.">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Lets Meshy add extra descriptive detail</span>
              <Toggle checked={enablePromptExpansion} onChange={(v) => updateSettings({ enablePromptExpansion: v })} />
            </div>
          </Field>
        </>
      )}

      <Field label="Enable Safety Checker" hint="Filter prompts that may violate content policy before they run.">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Illustrative — not yet enforced server-side</span>
          <Toggle checked={enableSafetyChecker} onChange={(v) => updateSettings({ enableSafetyChecker: v })} />
        </div>
      </Field>

      {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleReset}
          className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border-subtle transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-40 hover:brightness-95 transition-[filter] py-2.5"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isSubmitting ? "Generating…" : `Generate (${formatCostUSD(estimatedCostUSD)} · ${formatCostINR(estimatedCostUSD)})`}
        </button>
      </div>
    </div>
  );
}
