/**
 * Small outlined rectangle glyph representing an aspect ratio (e.g. "16:9",
 * "9:16", "1:1") — scaled so the longer side always fills the icon box,
 * matching the little ratio-shaped icons shown next to each option in the
 * reference aspect-ratio picker.
 */
export function AspectRatioIcon({ ratio, className }: { ratio: string; className?: string }) {
  const [wStr, hStr] = ratio.split(":");
  const w = Number(wStr) || 1;
  const h = Number(hStr) || 1;

  const BOX = 16;
  const MAX_DIM = 13;
  const scale = MAX_DIM / Math.max(w, h);
  const rectW = Math.max(5, Math.round(w * scale));
  const rectH = Math.max(5, Math.round(h * scale));

  return (
    <svg
      width={BOX}
      height={BOX}
      viewBox={`0 0 ${BOX} ${BOX}`}
      className={className}
      aria-hidden
      shapeRendering="geometricPrecision"
    >
      <rect
        x={(BOX - rectW) / 2}
        y={(BOX - rectH) / 2}
        width={rectW}
        height={rectH}
        rx={1.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
      />
    </svg>
  );
}
