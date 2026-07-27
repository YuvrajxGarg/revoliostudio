"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-styled replacement for the browser's native `confirm()` — same
 * surface/border treatment as UpscaleModal/ShareModal, portaled to
 * document.body (see GenerationDetailPanel for why: any blurred studio pane
 * would otherwise trap a plain `fixed inset-0` to its own bounds).
 *
 * Used anywhere a destructive or state-changing bulk action (delete,
 * add/remove from project, etc.) used to fire a native `confirm()`/
 * `window.confirm()` popup — those look like a browser warning rather than
 * part of the product and can't be styled or themed.
 */
export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red/danger styling for destructive actions (delete). Defaults to the
   * accent color for neutral confirmations (add/remove from project). */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, loading]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-6"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="animate-modal-in w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              danger ? "bg-danger/10 text-danger-text" : "bg-accent/10 text-accent"
            )}
          >
            <AlertTriangle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="text-sm font-semibold">{title}</div>
            {description && <p className="mt-1 text-xs text-muted leading-relaxed">{description}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 flex items-center justify-center rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-[filter] disabled:opacity-50",
              danger ? "bg-danger hover:brightness-95" : "bg-accent hover:brightness-95"
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
