/**
 * A recentered version of lucide's "Play" glyph.
 *
 * lucide's stock Play triangle is a filled shape whose visual weight (its
 * centroid, not its bounding box) sits noticeably left of the icon's own
 * 24x24 box — a two-point vertical base at x=5 pulls more mass toward the
 * left than the single apex point (around x=20) pulls toward the right. This
 * is invisible when the icon sits next to a text label (the label anchors
 * the eye), but glaring wherever it's the sole content of a round button —
 * video thumbnail overlays, the big video player button — which is exactly
 * how it's used here.
 *
 * This is the same path, with every absolute x-coordinate shifted +2 so the
 * triangle's centroid lands on the box's actual center, and stroke
 * explicitly disabled. (lucide's default stroke, left un-set, would render
 * on top of the fill with round joins that blunt the sharp apex more than
 * the two blunter base corners, dragging the visual weight back left again
 * and partially undoing the correction.)
 */
export function PlayTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 7 19z" />
    </svg>
  );
}
