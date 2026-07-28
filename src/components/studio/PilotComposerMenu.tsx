"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Upload, Shapes, Workflow, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadReferenceFile } from "@/lib/upload";
import { formatErrorMessage } from "@/lib/errorFormat";

/**
 * The "+" button next to Pilot's brief input — Revolio's take on Higgsfield's
 * composer "+" menu. Only the two entries with a real backend behind them:
 * Elements (Style/Character/Location/Element references, via the same
 * ReferencePicker every studio composer already uses) and Use a Flow (only
 * for admins, since Flows itself is still admin-gated everywhere else in the
 * app). "Use employee" and "Connectors" have no equivalent anywhere in
 * Revolio and are deliberately left out rather than shipped as inert stubs.
 */
export function PilotComposerMenu({
  onUpload,
  onOpenElements,
  onOpenFlowPicker,
  canUseFlows,
  disabled,
}: {
  onUpload: (url: string) => void;
  onOpenElements: () => void;
  onOpenFlowPicker: () => void;
  canUseFlows: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portaled + click-away, same reasoning as AutopilotReferencePicker/LlmModelSelector
  // (this composer sits inside a backdrop-blur pane, which traps fixed descendants).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleOpen() {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setOpen((v) => !v);
  }

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadReferenceFile(file);
      onUpload(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={disabled}
        title="Add elements, upload a file, or use a Flow"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle text-muted hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-40",
          open && "bg-surface-2 text-foreground"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", bottom: pos.bottom, left: pos.left }}
            className="z-[70] w-60 rounded-xl border border-border-subtle bg-surface shadow-2xl p-1.5 flex flex-col gap-0.5"
          >
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-left hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload a file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => {
                setOpen(false);
                onOpenElements();
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-left hover:bg-surface-2 transition-colors"
            >
              <Shapes className="h-3.5 w-3.5" />
              Elements
            </button>
            {canUseFlows && (
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenFlowPicker();
                }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-left hover:bg-surface-2 transition-colors"
              >
                <Workflow className="h-3.5 w-3.5" />
                Use a Flow
              </button>
            )}
            {error && <div className="px-2.5 py-1 text-[10px] text-danger-text">{formatErrorMessage(error).message}</div>}
          </div>,
          document.body
        )}
    </div>
  );
}
