/**
 * Small isometric wireframe cube — the light/camera marker on both
 * Relight's and Angle Generator's orbit dial, matching Higgsfield's plain
 * gray-outline cube glyph. Symmetric by design, so unlike a directional
 * icon (an earlier flashlight glyph), it never needs to be rotated to
 * "face" the right way — one less thing that can render wrong.
 */
export function CubeGlyph({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M12 3 L19.79 7.5 L19.79 16.5 L12 21 L4.21 16.5 L4.21 7.5 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 12 L12 3 M12 12 L19.79 16.5 M12 12 L4.21 16.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
