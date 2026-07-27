"use client";

import { useRef, useState } from "react";
import { Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayTriangleIcon } from "@/components/ui/PlayTriangleIcon";

/**
 * Shared video element for generation thumbnails/previews. Videos no longer
 * autoplay on mount (was surprising when switching tabs/selecting items) —
 * instead this renders a play/pause toggle over the first frame so the user
 * decides when playback starts.
 */
export function VideoThumb({
  src,
  className,
  controlSize = "sm",
  controls,
  onLoaded,
  fill = false,
}: {
  src: string;
  className?: string;
  controlSize?: "sm" | "md" | "lg";
  /** Pass through native video controls (used for the large studio preview). */
  controls?: boolean;
  /** Fires once the first frame's data is available — lets callers keep a
   * placeholder in place until there's actually something to show instead
   * of a blank box while the video downloads. */
  onLoaded?: () => void;
  /** True when the caller absolutely-positions the <video> to fill a sized
   * box (the gallery grid's `fill` cards). Without this the wrapper — which
   * is `relative` and has only an out-of-flow absolute video inside —
   * collapses to zero height, so the centered play button snaps to the top
   * edge and spills out of the card. Making the wrapper fill the box fixes
   * both the wrapper size and the overlay centering. */
  fill?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }

  const iconClass =
    controlSize === "lg" ? "h-6 w-6" : controlSize === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const btnClass =
    controlSize === "lg" ? "h-12 w-12" : controlSize === "md" ? "h-10 w-10" : "h-7 w-7";

  return (
    <div className={cn("group/thumb", fill ? "absolute inset-0" : "relative")}>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        controls={controls}
        className={className}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        // Firing `onLoaded` from just `onLoadedData` was flaky — some
        // browsers/connections never reach that event promptly (default
        // preload heuristics vary), leaving the caller's placeholder stuck
        // forever even though the video was fine. Wiring it to whichever of
        // these fires first is far more reliable; calling the same setState
        // more than once is harmless.
        onLoadedData={onLoaded}
        onLoadedMetadata={onLoaded}
        onCanPlay={onLoaded}
      />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none",
          playing ? "opacity-0 group-hover/thumb:opacity-100" : "opacity-100"
        )}
      >
        {/* Callers frequently wrap VideoThumb in their own <button> (the
            whole card/row is clickable to open the detail panel) — a real
            nested <button> is invalid HTML and throws a hydration error, so
            this is a focusable <span role="button"> instead, same pattern as
            the download control in VideoHistoryFeed. */}
        <span
          role="button"
          tabIndex={0}
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(e);
            }
          }}
          className={cn(
            "pointer-events-auto flex items-center justify-center rounded-full bg-black/60 hover:bg-black/75 text-white transition-colors",
            btnClass
          )}
        >
          {playing ? (
            <Pause className={iconClass} fill="currentColor" />
          ) : (
            <PlayTriangleIcon className={iconClass} />
          )}
        </span>
      </div>
    </div>
  );
}
