"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Video, ImagePlus, X } from "lucide-react";
import { getModel, modelsByCategoryAndMode } from "@/lib/models";
import { estimateCostUSD, formatCostUSD, formatCostINR } from "@/lib/pricing";
import { Dropdown } from "@/components/ui/Dropdown";
import { AspectRatioIcon } from "@/components/ui/AspectRatioIcon";
import { ModelSelector } from "./ModelSelector";
import { formatErrorMessage } from "@/lib/errorFormat";
import { uploadReferenceFile } from "@/lib/upload";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

const DEFAULT_MODEL_ID = "runway-motion-control";

function UploadTile({
  kind,
  label,
  hint,
  optional,
  url,
  uploading,
  onUpload,
  onClear,
  onView,
}: {
  kind: "video" | "image";
  label: string;
  hint?: string;
  optional?: boolean;
  url: string | null;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onView: (url: string, kind: "video" | "image") => void;
}) {
  if (url) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-2">
        {kind === "video" ? (
          <video
            src={url}
            muted
            loop
            playsInline
            autoPlay
            onClick={() => onView(url, "video")}
            title="Click to view full size"
            className="w-full h-32 object-cover cursor-pointer"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            title="Click to view full size"
            onClick={() => onView(url, "image")}
            className="w-full h-32 object-cover cursor-pointer hover:brightness-90 transition-[filter]"
          />
        )}
        <button
          onClick={onClear}
          title="Remove"
          className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text hover:border-danger/40 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <label className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-subtle bg-surface-2 py-6 text-center hover:border-foreground/40 transition-colors cursor-pointer">
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      ) : kind === "video" ? (
        <Video className="h-5 w-5 text-muted" />
      ) : (
        <ImagePlus className="h-5 w-5 text-muted" />
      )}
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="text-muted font-normal"> (Optional)</span>}
      </span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
      <input
        type="file"
        accept={kind === "video" ? "video/*" : "image/*"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function MotionControlComposer({ onGenerated }: { onGenerated?: () => void }) {
  const models = modelsByCategoryAndMode("video", "motion");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const model = getModel(modelId) ?? models[0];

  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionUploading, setMotionUploading] = useState(false);
  const [characterUrl, setCharacterUrl] = useState<string | null>(null);
  const [characterUploading, setCharacterUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(model?.defaultAspectRatio ?? "16:9");
  // Wan Animate-style extras — only meaningful when the selected model
  // declares them (see motionModeOptions/motionResolutionOptions on
  // ModelConfig); Runway Act-Two has neither, so these just stay unset.
  const [motionMode, setMotionMode] = useState<string | undefined>(model?.defaultMotionMode);
  const [resolution, setResolution] = useState<string | undefined>(model?.defaultMotionResolution);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; kind: "video" | "image" } | null>(null);

  // Re-sync the model-specific defaults whenever the user switches models —
  // otherwise switching from Wan Animate to Act-Two (or back) could carry
  // over a stale aspect ratio / mode / resolution that the new model
  // doesn't even support.
  useEffect(() => {
    setAspectRatio(model?.defaultAspectRatio ?? "16:9");
    setMotionMode(model?.defaultMotionMode);
    setResolution(model?.defaultMotionResolution);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  const estimatedCostUSD = model ? estimateCostUSD(model, {}) : 0;

  async function handleSubmit() {
    if (!model || isSubmitting || !motionVideoUrl || !characterUrl) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: "",
          videoUrl: motionVideoUrl,
          characterImageUrl: characterUrl,
          settings: { aspectRatio, motionMode, resolution },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed to start");
      }
      // Deliberately not clearing the motion video/character here — keeping
      // them lets the user regenerate the same setup without re-uploading.
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <UploadTile
        kind="video"
        label="Add motion to copy"
        hint="Video duration: 3–30 seconds"
        url={motionVideoUrl}
        uploading={motionUploading}
        onUpload={async (f) => {
          setMotionUploading(true);
          setError(null);
          try {
            const { url } = await uploadReferenceFile(f);
            setMotionVideoUrl(url);
          } catch (err) {
            // Used to fail silently — the upload zone just stayed empty
            // with no indication why (e.g. a video over the 50MB cap).
            setError(err instanceof Error ? err.message : "Failed to upload video");
          } finally {
            setMotionUploading(false);
          }
        }}
        onClear={() => setMotionVideoUrl(null)}
        onView={(u, k) => setViewing({ url: u, kind: k })}
      />

      <UploadTile
        kind="image"
        label="Add your character"
        hint="Image with visible face and body"
        url={characterUrl}
        uploading={characterUploading}
        onUpload={async (f) => {
          setCharacterUploading(true);
          setError(null);
          try {
            const { url } = await uploadReferenceFile(f);
            setCharacterUrl(url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload image");
          } finally {
            setCharacterUploading(false);
          }
        }}
        onClear={() => setCharacterUrl(null)}
        onView={(u, k) => setViewing({ url: u, kind: k })}
      />

      <div className="panel-label">Model</div>
      {model && <ModelSelector models={models} selectedId={model.id} onSelect={setModelId} direction="down" />}

      {!!model?.motionModeOptions?.length && (
        <div className="flex flex-col gap-1.5">
          <div className="panel-label">Mode</div>
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-2 p-1">
            {model.motionModeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.description}
                onClick={() => setMotionMode(opt.value)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  motionMode === opt.value
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {motionMode && (
            <p className="text-[11px] text-muted leading-relaxed">
              {model.motionModeOptions.find((o) => o.value === motionMode)?.description}
            </p>
          )}
        </div>
      )}

      {!!model?.motionResolutionOptions?.length && (
        <div className="flex flex-col gap-1.5">
          <div className="panel-label">Resolution</div>
          <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-2 p-1">
            {model.motionResolutionOptions.map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => setResolution(res)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  resolution === res ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      {!!model?.aspectRatios?.length && (
        <Dropdown
          value={aspectRatio}
          onChange={setAspectRatio}
          options={model.aspectRatios.map((ar) => ({
            value: ar,
            label: ar,
            icon: <AspectRatioIcon ratio={ar} />,
          }))}
        />
      )}

      {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !model || !motionVideoUrl || !characterUrl}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity w-full py-2.5"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        {isSubmitting ? "Generating…" : "Generate"}
        {model && !isSubmitting && (
          <span className="text-xs font-normal opacity-70">
            · {formatCostUSD(estimatedCostUSD)} · {formatCostINR(estimatedCostUSD)}
          </span>
        )}
      </button>

      {viewing && (
        <ImageLightbox
          url={viewing.url}
          mediaType={viewing.kind === "video" ? "video" : "image"}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
