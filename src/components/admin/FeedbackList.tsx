"use client";

import { useState } from "react";
import { Bug, Check, Lightbulb, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeTime } from "@/lib/utils";

export interface FeedbackRow {
  id: string;
  type: "feature" | "resource" | "bug";
  body: string;
  image_url: string | null;
  page: string | null;
  status: "open" | "done" | "dismissed";
  created_at: string;
  email?: string;
}

/** Admin view of user feedback: feature/resource requests and bug reports. */
export function FeedbackList({ initial }: { initial: FeedbackRow[] }) {
  const [rows, setRows] = useState(initial);

  async function setStatus(id: string, status: FeedbackRow["status"]) {
    const supabase = createClient();
    await supabase.from("feedback").update({ status }).eq("id", id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("feedback").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle p-10 text-center text-sm text-muted">
        No feedback yet — bug reports and feature requests land here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface divide-y divide-border-subtle">
      {rows.map((r) => (
        <div key={r.id} className={cn("flex gap-3 px-4 py-3", r.status !== "open" && "opacity-50")}>
          <span className="mt-0.5 shrink-0">
            {r.type === "bug" ? (
              <Bug className="h-4 w-4 text-danger-text" />
            ) : (
              <Lightbulb className="h-4 w-4 text-accent" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="truncate">{r.email ?? "unknown"}</span>
              {r.page && <span className="truncate">· {r.page}</span>}
              <span className="shrink-0">· {formatRelativeTime(r.created_at)}</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase">{r.status}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{r.body}</p>
            {r.image_url && (
              <a href={r.image_url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image_url} alt="attachment" className="mt-2 max-h-40 rounded-lg border border-border-subtle" />
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            {r.status === "open" && (
              <button onClick={() => setStatus(r.id, "done")} title="Mark done" className="icon-btn-round !h-7 !w-7">
                <Check className="h-3 w-3 text-accent" />
              </button>
            )}
            <button onClick={() => remove(r.id)} title="Delete" className="icon-btn-round !h-7 !w-7 hover:!bg-danger/20">
              <Trash2 className="h-3 w-3 text-danger-text" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
