"use client";

import { useCallback, useRef } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoTransport {
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onMuteToggle: () => void;
}

function formatTime(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The center split-compare canvas — a raw `<img>`/`<video>` underneath (the
 * "before" layer, and for video, the actual decode/playback source) with the
 * processed `<canvas>` layered on top and clipped via `clip-path` up to the
 * drag handle's position (the "after" layer). Both layers sit in a
 * fixed-aspect-ratio box (set once the media's natural size is known) so
 * they line up pixel-for-pixel regardless of the working canvas's capped
 * render resolution.
 */
export function BeforeAfterPreview({
  sourceKind,
  sourceUrl,
  aspectRatio,
  imageRef,
  videoRef,
  outputCanvasRef,
  onMediaLoaded,
  splitPosition,
  onSplitPositionChange,
  showOriginal,
  transport,
}: {
  sourceKind: "image" | "video";
  sourceUrl: string;
  /** width/height once known, e.g. "1280 / 720" — null before the media has loaded. */
  aspectRatio: string | null;
  imageRef: React.RefObject<HTMLImageElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  outputCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onMediaLoaded: (naturalWidth: number, naturalHeight: number) => void;
  splitPosition: number;
  onSplitPositionChange: (pct: number) => void;
  showOriginal: boolean;
  transport: VideoTransport | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      onSplitPositionChange(Math.min(100, Math.max(0, pct)));
    },
    [onSplitPositionChange]
  );

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    updateFromClientX(e.clientX);
    function onMove(ev: PointerEvent) {
      updateFromClientX(ev.clientX);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0 p-4">
      <div
        ref={containerRef}
        className="relative max-h-full max-w-full overflow-hidden rounded-xl border border-border-subtle bg-black select-none"
        style={{ aspectRatio: aspectRatio ?? "16 / 9", width: "100%" }}
      >
        {sourceKind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={sourceUrl}
            alt="Source"
            className="absolute inset-0 h-full w-full object-contain"
            onLoad={(e) => onMediaLoaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={sourceUrl}
            playsInline
            loop
            className="absolute inset-0 h-full w-full object-contain"
            onLoadedMetadata={(e) => onMediaLoaded(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
          />
        )}

        {!showOriginal && (
          <canvas
            ref={outputCanvasRef}
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
          />
        )}

        {!showOriginal && (
          <div
            onPointerDown={startDrag}
            className="absolute inset-y-0 z-10 flex w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center"
            style={{ left: `${splitPosition}%` }}
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/80" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-black/60 text-white shadow-lg">
              <span className="text-[10px]">⇔</span>
            </div>
          </div>
        )}
      </div>

      {transport && (
        <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
          <button onClick={transport.onPlayPause} className="icon-btn-round shrink-0">
            {transport.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <span className="w-9 shrink-0 text-[11px] text-muted tabular-nums">{formatTime(transport.currentTime)}</span>
          <input
            type="range"
            min={0}
            max={transport.duration || 0}
            step={0.01}
            value={transport.currentTime}
            onChange={(e) => transport.onSeek(Number(e.target.value))}
            className="slider-thin w-full"
          />
          <span className="w-9 shrink-0 text-[11px] text-muted tabular-nums">{formatTime(transport.duration)}</span>
          <button onClick={transport.onMuteToggle} className={cn("icon-btn-round shrink-0")}>
            {transport.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
