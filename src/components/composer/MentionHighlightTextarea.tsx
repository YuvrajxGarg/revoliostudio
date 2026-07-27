"use client";

import { forwardRef, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MentionHighlightTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  /** Exact reference names (e.g. "Image 1") that count as a real, taggable mention — may contain spaces. */
  mentionLabels: string[];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A textarea that visually highlights "@Label" tokens as you type — e.g.
 * "@Image_1" renders as a pill-colored mention instead of plain text,
 * matching the Reference's tagged-reference styling.
 *
 * Implementation: a styled, non-interactive backdrop div sits behind a
 * transparent-text textarea (only the caret/selection paint on top). The
 * backdrop renders the same string, splitting "@token" runs into
 * highlighted spans. Scroll position is kept in sync so multi-line prompts
 * still line up while scrolling.
 */
export const MentionHighlightTextarea = forwardRef<HTMLTextAreaElement, MentionHighlightTextareaProps>(
  function MentionHighlightTextarea({ value, mentionLabels, className, onScroll, ...props }, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow with content instead of scrolling internally right away —
    // the textarea's own CSS max-height (set by the caller) still caps how
    // tall it can get before falling back to a scrollbar.
    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    function setRefs(node: HTMLTextAreaElement | null) {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    }

    // Match "@" followed by one of the *exact* known reference names (which
    // may contain spaces, e.g. "Image 1") rather than a generic \w+ token —
    // that's what lets multi-word labels highlight at all, and avoids
    // treating arbitrary "@word" text as a mention. Longest labels first so
    // e.g. "Image 10" isn't matched as "Image 1" + a stray "0".
    const sortedLabels = [...new Set(mentionLabels.filter(Boolean))].sort((a, b) => b.length - a.length);
    const mentionRegex = sortedLabels.length
      ? new RegExp(`@(${sortedLabels.map(escapeRegExp).join("|")})(?!\\w)`, "gi")
      : null;

    const parts: { text: string; mention: boolean }[] = [];
    if (mentionRegex) {
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(value))) {
        if (match.index > lastIndex) parts.push({ text: value.slice(lastIndex, match.index), mention: false });
        parts.push({ text: match[0], mention: true });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) parts.push({ text: value.slice(lastIndex), mention: false });
    } else if (value.length > 0) {
      parts.push({ text: value, mention: false });
    }

    function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
      const target = e.currentTarget;
      const backdrop = target.previousElementSibling as HTMLDivElement | null;
      if (backdrop) {
        backdrop.scrollTop = target.scrollTop;
        backdrop.scrollLeft = target.scrollLeft;
      }
      onScroll?.(e);
    }

    return (
      <div className="relative">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words select-none",
            className
          )}
        >
          {value.length === 0
            ? " "
            : parts.map((p, i) =>
                p.mention ? (
                  // box-shadow (not border/padding) so this doesn't add any
                  // width — it has to stay pixel-aligned with the real,
                  // invisible-text textarea rendered on top of it.
                  <span
                    key={i}
                    className="rounded-md bg-accent/20 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(232,80,2,0.55)]"
                  >
                    {p.text}
                  </span>
                ) : (
                  <span key={i} className="text-foreground">
                    {p.text}
                  </span>
                )
              )}
        </div>
        <textarea
          {...props}
          ref={setRefs}
          value={value}
          onScroll={handleScroll}
          className={cn("relative block text-transparent caret-foreground", className)}
        />
      </div>
    );
  }
);
