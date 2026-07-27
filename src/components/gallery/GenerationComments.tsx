"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { display_name: string | null; avatar_url: string | null; email: string | null } | null;
}

function authorName(c: CommentRow): string {
  return c.author?.display_name || c.author?.email?.split("@")[0] || "Someone";
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Comments thread for a generation — shown in the detail panel. Visibility is
 * governed entirely by RLS (owner, team-project members, or anyone if the
 * generation is published), so this just reads/writes the
 * `generation_comments` table directly with the browser client. Requires the
 * 0027 migration; degrades to a quiet "comments unavailable" if it isn't live.
 */
export function GenerationComments({ generationId }: { generationId: string }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const meRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    meRef.current = session?.user?.id ?? null;
    const { data, error } = await supabase
      .from("generation_comments")
      .select("*, author:profiles(display_name, avatar_url, email)")
      .eq("generation_id", generationId)
      .order("created_at", { ascending: true });
    if (error) {
      setUnavailable(true);
    } else {
      setComments((data ?? []) as CommentRow[]);
    }
    setLoading(false);
  }, [generationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    const text = body.trim();
    if (!text || sending || !meRef.current) return;
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("generation_comments")
      .insert({ generation_id: generationId, user_id: meRef.current, body: text })
      .select("*, author:profiles(display_name, avatar_url, email)")
      .single();
    setSending(false);
    if (!error && data) {
      setComments((prev) => [...prev, data as CommentRow]);
      setBody("");
    }
  }

  async function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    const supabase = createClient();
    await supabase.from("generation_comments").delete().eq("id", id);
  }

  if (unavailable) return null;

  return (
    <div className="mx-4 mt-3">
      <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Comments{comments.length > 0 ? ` (${comments.length})` : ""}
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-2/40 p-2 flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
          </div>
        ) : comments.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {comments.map((c) => (
              <div key={c.id} className="group flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-subtle text-[10px] font-semibold">
                  {authorName(c).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{authorName(c)}</span>
                    <span className="text-[10px] text-muted">{timeAgo(c.created_at)}</span>
                    {c.user_id === meRef.current && (
                      <button
                        onClick={() => remove(c.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-muted hover:text-danger-text transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Add a comment…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent max-h-24 overflow-y-auto"
          />
          <button
            onClick={submit}
            disabled={!body.trim() || sending}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40 hover:bg-accent-2"
            )}
            title="Send"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
