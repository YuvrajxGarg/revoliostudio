"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Image as ImageIcon, RotateCcw } from "lucide-react";
import { buildGlobeLines } from "@/lib/wireframeGlobe";
import { cn } from "@/lib/utils";

export interface StageHighlight {
  /** Position within the card's own box, 0-100. */
  x: number;
  y: number;
  color: string;
  /** 0-10, matches Relight's intensity scale. */
  intensity: number;
}

function NavButton({
  className,
  onClick,
  children,
  title,
}: {
  className: string;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "absolute z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-surface/80 text-muted backdrop-blur-sm transition-colors hover:text-foreground hover:border-white/25",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Shared "rotating wireframe globe" preview stage for Relight and Angle
 * Generator — the Higgsfield look. Unlike the earlier static globe, the
 * whole sphere is a real orthographic 3D projection (see
 * `@/lib/wireframeGlobe`) that visibly rotates as `azimuth`/`elevation`
 * change, so the marker overlaid by each tool via `children` rides *on* the
 * sphere rather than floating over a frozen backdrop. The four edge chevrons
 * snap the orientation in fixed steps.
 *
 * Every overlay SVG in `children` must set `viewBox="0 0 100 100"` (matching
 * the globe's own) so raw 0-100 coordinates line up with the
 * plain-percentage HTML markers.
 */
export function PreviewStage({
  imageUrl,
  azimuth = 0,
  elevation = 0,
  onReset,
  onNudge,
  hint,
  highlights,
  children,
}: {
  imageUrl: string | null;
  /** Drives the sphere's live rotation — the selected light / camera angle. */
  azimuth?: number;
  elevation?: number;
  onReset?: () => void;
  /** Wires up the four edge chevrons (snapping) — omit to hide them. */
  onNudge?: (dir: "up" | "down" | "left" | "right") => void;
  /** Short instruction line rendered above the sphere. */
  hint?: string;
  /** Soft colored glow on the card's own surface (clipped, screen-blended) — Relight's "light bounces off the image" effect. */
  highlights?: StageHighlight[];
  children?: React.ReactNode;
}) {
  const globeLines = useMemo(() => buildGlobeLines(azimuth, elevation), [azimuth, elevation]);

  return (
    <div>
      {hint && <p className="mb-2 text-center text-[11px] font-medium text-muted">{hint}</p>}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-border-subtle"
        style={{ background: "radial-gradient(circle at 50% 32%, #232326 0%, #131315 65%, #09090a 100%)" }}
      >
        {/* Rotating wireframe globe */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          {globeLines.map((l, i) => (
            <polyline
              key={i}
              points={l.points}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={l.opacity}
              strokeWidth="0.5"
            />
          ))}
        </svg>

        {onNudge && (
          <>
            <NavButton title="Tilt up" className="left-1/2 top-1.5 -translate-x-1/2" onClick={() => onNudge("up")}>
              <ChevronUp className="h-3.5 w-3.5" />
            </NavButton>
            <NavButton title="Tilt down" className="left-1/2 bottom-1.5 -translate-x-1/2" onClick={() => onNudge("down")}>
              <ChevronDown className="h-3.5 w-3.5" />
            </NavButton>
            <NavButton title="Rotate left" className="left-1.5 top-1/2 -translate-y-1/2" onClick={() => onNudge("left")}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </NavButton>
            <NavButton title="Rotate right" className="right-1.5 top-1/2 -translate-y-1/2" onClick={() => onNudge("right")}>
              <ChevronRight className="h-3.5 w-3.5" />
            </NavButton>
          </>
        )}

        {/* The subject card — flat, centered, facing the viewer (it stays put; the sphere orbits around it). */}
        <div className="absolute left-1/2 top-1/2 z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-surface-2 shadow-2xl">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}

          {/* Light-bounce glow, clipped to the card by its own overflow-hidden so it reads as light hitting the photo's surface. */}
          {highlights?.map((h, i) => (
            <div
              key={i}
              className="pointer-events-none absolute h-[85%] w-[85%] rounded-full"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${h.color} 0%, transparent 68%)`,
                opacity: Math.min(0.9, 0.2 + (h.intensity / 10) * 0.55),
                mixBlendMode: "screen",
              }}
            />
          ))}
        </div>

        {children}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Reset"
            className="absolute bottom-1.5 right-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
