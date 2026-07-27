"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A bare fullscreen image viewer — just the image and a close button, no
 * prompt/details/edit sidebar. For viewing a plain reference/source image at
 * full size (an @ reference, a start/end frame, an uploaded character photo,
 * etc.) where there's often no real `Generation` row behind it to show
 * details for in the first place. See GenerationDetailPanel for the full
 * version used on an actual completed generation.
 *
 * Portaled to document.body (not rendered inline) for the same reason
 * GenerationDetailPanel is: every studio pane uses backdrop-blur, which
 * establishes a containing block for `fixed` descendants and would otherwise
 * clip/trap this to whichever blurred panel it was opened from instead of
 * showing a real fullscreen view.
 */
export function ImageLightbox({
  url,
  alt,
  onClose,
  mediaType = "image",
}: {
  url: string;
  alt?: string;
  onClose: () => void;
  /** Defaults to "image". Set to "video"/"audio" when the URL being previewed
   * isn't a still image (e.g. an Autopilot step result, a motion-control
   * source clip) — still the same bare portal-to-body viewer, just with the
   * right tag for the media. */
  mediaType?: "image" | "video" | "audio";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6" onClick={onClose}>
      <button
        onClick={onClose}
        title="Close"
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-surface/80 text-foreground hover:bg-surface transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      {mediaType === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={url}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl"
        />
      ) : mediaType === "audio" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={url} controls autoPlay onClick={(e) => e.stopPropagation()} className="w-80 max-w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ""}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      )}
    </div>,
    document.body
  );
}
