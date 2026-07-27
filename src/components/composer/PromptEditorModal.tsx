"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Dices,
  ImageIcon,
  Loader2,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

const MAX_LENGTH = 2000;

/**
 * Magnific-style "Prompt editor" flyout — an expanded writing surface plus
 * an AI side panel (chat, Random/Auto prompt, Image to prompt) for
 * composing a prompt with more room and some AI help, then applying it back
 * to the composer in one shot. Nothing here touches the real composer state
 * until "Apply prompt" is clicked — closing without applying (X, Escape, or
 * clicking the backdrop) leaves the original prompt untouched, same as
 * every other modal in the app.
 *
 * Portaled to document.body for the same reason every other fullscreen
 * overlay in this app is (see GenerationDetailPanel/ImageLightbox) — a
 * `fixed inset-0` opened from inside any of the studios' backdrop-blur
 * panels would otherwise be clipped/trapped to that panel's own bounds
 * instead of covering the real viewport.
 */
export function PromptEditorModal({
  category,
  initialPrompt,
  referenceUrls,
  onApply,
  onClose,
}: {
  category: Category;
  initialPrompt: string;
  /** Currently-attached reference image URLs — offered as the "Image to prompt" picker's source list rather than building a separate upload flow inside this modal. */
  referenceUrls: string[];
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [draft, setDraft] = useState(initialPrompt);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickBusy, setQuickBusy] = useState<"random" | "auto" | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const busy = sending || quickBusy !== null || imgBusy;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  async function callAssist<T extends Record<string, unknown>>(body: T): Promise<{ reply?: string; prompt?: string }> {
    const res = await fetch("/api/prompt-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  async function runQuick(action: "random" | "auto") {
    if (busy) return;
    setQuickBusy(action);
    setError(null);
    try {
      const { prompt } = await callAssist({ action, category, draft });
      if (prompt) setDraft(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setQuickBusy(null);
    }
  }

  async function runImageToPrompt(url: string) {
    if (busy) return;
    setImagePickerOpen(false);
    setImgBusy(true);
    setError(null);
    try {
      const { prompt } = await callAssist({ action: "image-to-prompt", category, imageUrl: url });
      if (prompt) setDraft(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImgBusy(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || busy) return;
    setChatInput("");
    setError(null);
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setSending(true);
    try {
      const { reply } = await callAssist({ action: "chat", category, draft, message: text, history });
      if (reply) setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6" onClick={() => !busy && onClose()}>
      <div
        className="flex w-full max-w-5xl h-[85vh] max-h-[720px] flex-col rounded-2xl border border-border-subtle bg-surface overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle shrink-0">
          <span className="text-sm font-semibold">Prompt editor</span>
          <button onClick={onClose} className="icon-btn-round" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          {/* Left: expanded writing surface. */}
          <div className="relative flex flex-col p-5 min-h-0">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="Describe your image"
              className="flex-1 w-full resize-none bg-transparent text-sm placeholder:text-muted outline-none"
              autoFocus
            />
            <span className="pointer-events-none text-[10px] tabular-nums text-muted">
              {draft.length}/{MAX_LENGTH}
            </span>
          </div>

          {/* Right: AI side panel — chat, backed by /api/prompt-assist. */}
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-muted">
                  <MessageCircle className="h-6 w-6" />
                  <p className="text-sm">Ask me anything about your prompt</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                        m.role === "user" ? "bg-accent text-white" : "bg-surface-2 text-foreground"
                      )}
                    >
                      {m.text}
                    </div>
                    {m.role === "assistant" && (
                      <button
                        onClick={() => setDraft(m.text)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:text-accent transition-colors"
                        title="Replace the draft on the left with this"
                      >
                        <Check className="h-3 w-3" /> Use this
                      </button>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 pt-1 pb-2 flex items-center gap-2 shrink-0">
              <button
                onClick={() => runQuick("random")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
              >
                {quickBusy === "random" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dices className="h-3.5 w-3.5" />}
                Random prompt
              </button>
              <button
                onClick={() => runQuick("auto")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-medium hover:bg-border-subtle transition-colors disabled:opacity-50"
              >
                {quickBusy === "auto" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Auto prompt
              </button>
            </div>

            <div className="px-4 pb-4 flex items-end gap-2 shrink-0">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Describe your creative idea…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm placeholder:text-muted outline-none focus:border-accent/60 transition-colors max-h-24"
              />
              <button
                onClick={sendChat}
                disabled={busy || !chatInput.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40 hover:bg-accent-2 transition-colors"
                title="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 border-t border-border-subtle text-xs text-danger-text shrink-0">{error}</div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle shrink-0">
          <div className="relative">
            <button
              onClick={() => referenceUrls.length > 0 && setImagePickerOpen((v) => !v)}
              disabled={referenceUrls.length === 0 || busy}
              title={referenceUrls.length === 0 ? "Attach a reference image first" : undefined}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Image to prompt
              <ChevronDown className="h-3 w-3" />
            </button>
            {imagePickerOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-2xl">
                <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Pick a reference
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {referenceUrls.map((url, i) => (
                    <button
                      key={url + i}
                      onClick={() => runImageToPrompt(url)}
                      className="h-12 w-12 overflow-hidden rounded-lg border border-border-subtle hover:border-accent/60 transition-colors"
                      title={`Use Image ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white disabled:opacity-40 hover:brightness-95 transition-[filter]"
          >
            Apply prompt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
