/**
 * Custom Generate-button icon — a large sparkle with a smaller sparkle
 * offset to the bottom-right, matching the reference icon supplied for the
 * composer's Generate button.
 */
const SPARKLE_PATH =
  "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";

export function GenerateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="scale(0.8) translate(-2,-2)">
        <path d={SPARKLE_PATH} fill="currentColor" />
      </g>
      <g transform="translate(10.1,10.1) scale(0.45)">
        <path d={SPARKLE_PATH} fill="currentColor" />
      </g>
    </svg>
  );
}
