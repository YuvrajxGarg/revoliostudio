"use client";

import { useRef } from "react";
import { Loader2, Music, Plus, X } from "lucide-react";

/**
 * Multi-slot video/audio reference row — the media-file counterpart of the
 * image ReferenceTray, for models whose live schema exposes a video ARRAY
 * (`videoListField` on ModelSchemaInfo: Seedance Omni's videos_list /
 * video_files, wan2.7-ref's videos_list) or an audio input (`audioRefField`:
 * wan2.7's single audio_url, Seedance Omni / Video Edit's audios_list /
 * audio_files). Videos render as looping thumbnails; audio (no frame to
 * thumbnail) as a labeled pill. Purely presentational — the parent owns the
 * item list and the upload (PromptComposer keeps it in the composer store,
 * EditVideoComposer in local state).
 */
export function MediaReferenceList({
  kind,
  label,
  items,
  max,
  uploading,
  onUpload,
  onRemove,
}: {
  kind: "video" | "audio";
  label: string;
  items: { id: string; url: string; name: string }[];
  max: number;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="panel-label">
        {label}
        {max > 1 && <span className="font-normal text-muted"> — {items.length}/{max}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {items.map((item) =>
          kind === "video" ? (
            <div key={item.id} className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-border-subtle group">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={item.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              <button
                onClick={() => onRemove(item.id)}
                title="Remove"
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ) : (
            <div
              key={item.id}
              className="flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2 text-xs"
              title={item.name}
            >
              <Music className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="min-w-0 truncate">{item.name}</span>
              <button
                onClick={() => onRemove(item.id)}
                title="Remove"
                className="shrink-0 text-muted hover:text-danger-text transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        )}
        {items.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`${
              kind === "video" ? "h-14 w-20" : "h-8 px-2.5"
            } shrink-0 rounded-lg border border-dashed border-border-subtle flex items-center justify-center gap-1 text-muted hover:text-foreground hover:border-foreground/40 transition-colors`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {kind === "audio" && <span className="text-xs">Audio</span>}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "video" ? "video/*" : "audio/*"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
