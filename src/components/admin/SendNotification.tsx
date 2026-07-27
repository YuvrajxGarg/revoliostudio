"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, Trash2, Bell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/utils";

interface SentNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export function SendNotification() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const json = await res.json();
      setSent(json.notifications ?? []);
    } catch {
      setSent([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    if (!title.trim()) return;
    setSending(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setTitle("");
        setBody("");
        setNote("Sent to all users.");
        load();
      } else {
        setNote(json.error || "Failed to send");
      }
    } catch {
      setNote("Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    setSent((s) => s.filter((n) => n.id !== id));
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    } catch {
      // best-effort — reload to resync if it failed
      load();
    }
  }

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Send notification</h2>
        <span className="text-[11px] text-muted">Broadcasts to every user, pops up on their next visit</span>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          placeholder="Message (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={sending || !title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition-[filter] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to all users
          </button>
          {note && <span className="text-[11px] text-muted">{note}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-muted">Recently sent</div>
        {loading ? (
          <div className="text-xs text-muted py-2">Loading…</div>
        ) : sent.length === 0 ? (
          <div className="text-xs text-muted py-2">Nothing sent yet.</div>
        ) : (
          <div className="rounded-xl border border-border-subtle divide-y divide-border-subtle">
            {sent.map((n) => (
              <div key={n.id} className="flex items-start gap-2.5 px-3 py-2.5">
                <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted line-clamp-2">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-muted">{formatRelativeTime(n.created_at)}</div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  title="Delete"
                  className="shrink-0 text-muted hover:text-danger-text transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
