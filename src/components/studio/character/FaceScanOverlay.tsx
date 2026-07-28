"use client";

import { useEffect, useState } from "react";

const SCAN_LINES = [
  "> booting face_scan.sh",
  "> loading reference frame...",
  "> detecting_face() ... ok",
  "> mapping_features() ... ok",
  "> reading_skin_tone() ...",
  "> analyzing_bone_structure() ...",
  "> extracting_anchor_phrase() ...",
];
const LINE_INTERVAL_MS = 850;
const MAX_VISIBLE_LINES = 4;

/**
 * Purely decorative sci-fi face-scan effect shown over the uploaded photo
 * while the vision-LLM metadata call is in flight (the "analyzing" phase —
 * see GenerateTab). There's nothing real being detected client-side; this
 * is a loading indicator dressed up to match the reference's own
 * "Eyes detected / Hair detected / Skin mapped" framing.
 *
 * Split into two pieces on purpose: this component is just the visual
 * scan effect (corner brackets, sweeping line, tint) laid directly over the
 * photo, since text sitting on top of the image read as amateurish. The
 * actual status text lives in the separate `ScanTerminal` below, rendered
 * underneath the photo as a proper monospace terminal-log readout.
 */
export function FaceScanOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      <div className="absolute inset-0 bg-accent/5" />
      {/* Viewfinder corner brackets */}
      <div className="absolute left-1.5 top-1.5 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-accent" />
      <div className="absolute right-1.5 top-1.5 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-accent" />
      <div className="absolute bottom-1.5 left-1.5 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-accent" />
      <div className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-accent" />
      {/* Sweeping scan line */}
      <div className="animate-scan-line absolute inset-x-0 h-0.5 bg-accent shadow-[0_0_10px_2px_var(--accent)]" />
    </div>
  );
}

/**
 * The scan's status readout — a small green-on-black terminal log below the
 * photo, appending a new line every tick and keeping only the last few (like
 * `tail -f`), with a blinking block cursor on the newest line. Deliberately
 * not on top of the image anymore (see FaceScanOverlay's doc comment).
 */
export function ScanTerminal({ active }: { active: boolean }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }
    let i = 0;
    setLines([SCAN_LINES[0]]);
    const timer = setInterval(() => {
      i = (i + 1) % SCAN_LINES.length;
      setLines((prev) => [...prev, SCAN_LINES[i]].slice(-MAX_VISIBLE_LINES));
    }, LINE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (!active || lines.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-accent/20 bg-black px-3 py-2 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        return (
          <div key={i} className={isLast ? "text-accent" : "text-accent/40"}>
            {line}
            {isLast && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
          </div>
        );
      })}
    </div>
  );
}
