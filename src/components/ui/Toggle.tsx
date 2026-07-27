"use client";

import { cn } from "@/lib/utils";

/**
 * Standard on/off switch used across composer settings panels.
 *
 * The thumb needs an explicit `left-*` base position — without it, the
 * browser falls back to an implicit "auto" static position for the
 * absolutely-positioned thumb, which isn't a stable anchor for the
 * `translate-x-*` transform to animate from. That's what caused the visual
 * glitch where the circle appeared to "move out" of the track on toggle.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-border-subtle"
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}
