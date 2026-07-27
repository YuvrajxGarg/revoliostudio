"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useComposerStore } from "@/store/composerStore";
import { nanoid } from "nanoid";
import { uploadReferenceFile } from "@/lib/upload";
import { formatErrorMessage } from "@/lib/errorFormat";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

function Slot({
  label,
  url,
  onUpload,
  onClear,
  onView,
}: {
  label: string;
  url: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  onView: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border-subtle">
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              title="Click to view full size"
              onClick={() => onView(url)}
              className="h-full w-full object-cover cursor-pointer hover:brightness-90 transition-[filter]"
            />
            <button
              onClick={onClear}
              title="Remove"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground shadow-md hover:bg-danger/10 hover:text-danger-text hover:border-danger/40 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="h-full w-full flex items-center justify-center border border-dashed border-border-subtle text-muted hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <span className="text-[11px] text-muted">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}

export function FrameSlots() {
  const { startFrame, endFrame, setStartFrame, setEndFrame } = useComposerStore();
  const [error, setError] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

  async function upload(file: File, setter: (r: { id: string; url: string; name: string } | null) => void) {
    setError(null);
    try {
      const { url, name } = await uploadReferenceFile(file);
      setter({ id: nanoid(8), url, name });
    } catch (err) {
      // This used to fail silently — the slot would just stay empty with no
      // indication why (e.g. an oversized frame image). Now the real error
      // (size, type, auth, network) shows up here.
      setError(err instanceof Error ? err.message : "Failed to upload image");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4 px-1">
        <Slot
          label="Start frame"
          url={startFrame?.url ?? null}
          onUpload={(f) => upload(f, setStartFrame)}
          onClear={() => setStartFrame(null)}
          onView={setViewingUrl}
        />
        <Slot
          label="End frame"
          url={endFrame?.url ?? null}
          onUpload={(f) => upload(f, setEndFrame)}
          onClear={() => setEndFrame(null)}
          onView={setViewingUrl}
        />
      </div>
      {error && <div className="px-1 text-[11px] text-danger-text">{formatErrorMessage(error).message}</div>}
      {viewingUrl && <ImageLightbox url={viewingUrl} onClose={() => setViewingUrl(null)} />}
    </div>
  );
}
