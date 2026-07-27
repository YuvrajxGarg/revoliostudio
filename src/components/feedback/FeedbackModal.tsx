"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bug, ImagePlus, Lightbulb, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type FeedbackType = "feature" | "bug";

/**
 * "Request a resource/feature" and "Report a bug" drawer — slides out next
 * to the sidebar (portaled to <body>, Magnific-style). Bug reports can
 * attach a screenshot through the existing /api/upload route.
 */
export function FeedbackModal({
  type,
  left,
  onClose,
}: {
  type: FeedbackType;
  /** Viewport x-offset the drawer starts at (right edge of the sidebar). */
  left: number;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    }
    // Delay a tick so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const isBug = type === "bug";

  async function handleAttach(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setError("Not signed in");
      setSending(false);
      return;
    }
    const { error: insertError } = await supabase.from("feedback").insert({
      user_id: session.user.id,
      type: isBug ? "bug" : "feature",
      body: body.trim(),
      image_url: imageUrl,
      page: pathname,
    });
    setSending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDone(true);
    setTimeout(onClose, 1200);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      ref={drawerRef}
      style={{ left, width: Math.min(380, window.innerWidth - left - 12) }}
      className="fixed top-2 bottom-2 z-[70] flex flex-col rounded-2xl border border-border-subtle bg-surface shadow-2xl animate-toast-in"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {isBug ? <Bug className="h-4 w-4 text-danger-text" /> : <Lightbulb className="h-4 w-4 text-accent" />}
          {isBug ? "Report a bug" : "Request a resource or feature"}
        </h2>
        <button onClick={onClose} className="text-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {done ? (
        <div className="flex flex-1 items-center justify-center text-sm">Thanks — sent to the team!</div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder={
              isBug
                ? "What happened? What did you expect instead?"
                : "What tool, resource or feature should we add?"
            }
            className="w-full resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />

          {isBug && (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-muted hover:text-foreground transition-colors">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {imageUrl ? "Replace screenshot" : "Attach screenshot"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleAttach(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="attached"
                  className="h-9 w-9 rounded-lg object-cover border border-border-subtle"
                />
              )}
            </div>
          )}

          {error && <div className="text-xs text-danger-text">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={sending || !body.trim()}
            className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-2"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
