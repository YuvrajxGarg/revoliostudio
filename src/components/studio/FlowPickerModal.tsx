"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Workflow, Search, X, Loader2, Clapperboard, Image as ImageIcon, Music2, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlows } from "@/hooks/useFlows";
import type { Flow } from "@/lib/flow-types";
import type { Category } from "@/lib/models";

function CatIcon({ c }: { c: Category }) {
  const cls = "h-3 w-3";
  if (c === "video") return <Clapperboard className={cls} />;
  if (c === "audio") return <Music2 className={cls} />;
  if (c === "3d") return <Box className={cls} />;
  return <ImageIcon className={cls} />;
}

function authorName(f: Flow): string {
  return f.author?.display_name || f.author?.email?.split("@")[0] || "Someone";
}

/**
 * Pilot's "Use a Flow" composer entry — a compact search/pick list over the
 * same `useFlows` data FlowsView's full page uses, minus the manage actions
 * (publish/delete/personalize) that don't make sense mid-conversation. Picking
 * a flow just hands it up to the caller (AutopilotView), which opens the
 * existing RunFlowModal — same run path FlowsView itself uses.
 */
export function FlowPickerModal({ onPick, onClose }: { onPick: (flow: Flow) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [query, setQuery] = useState("");
  const mineFlows = useFlows("mine");
  const publicFlows = useFlows("public");
  const active = tab === "mine" ? mineFlows : publicFlows;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active.flows;
    return active.flows.filter((f) => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q));
  }, [active.flows, query]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex h-[70vh] max-h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-subtle p-3">
          <Workflow className="h-4 w-4 text-accent shrink-0" />
          <span className="text-sm font-semibold shrink-0">Use a Flow</span>
          <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 flex-1 max-w-[14rem]">
            <Search className="h-3.5 w-3.5 text-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
            />
          </div>
          <button onClick={onClose} title="Close" className="icon-btn-round shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-border-subtle p-2">
          {(["mine", "public"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {t === "mine" ? "My flows" : "Community"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {active.loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
              <Workflow className="h-6 w-6" />
              <p className="text-xs max-w-[16rem]">
                {tab === "mine"
                  ? "No flows yet — plan a multi-step Autopilot run, then hit “Save as Flow”."
                  : "No published flows yet."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onPick(f)}
                  className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-2/40 p-3 text-left transition-colors hover:border-accent/50 hover:bg-surface-2"
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                    <Workflow className="h-3.5 w-3.5 text-accent shrink-0" /> {f.name}
                  </div>
                  {f.description && <p className="text-xs text-muted leading-relaxed line-clamp-1">{f.description}</p>}
                  <div className="flex items-center gap-1 flex-wrap">
                    {f.steps.slice(0, 6).map((s, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-muted"
                        title={s.label}
                      >
                        <CatIcon c={s.category} /> {i + 1}
                      </span>
                    ))}
                    {f.steps.length > 6 && <span className="text-[10px] text-muted">+{f.steps.length - 6}</span>}
                    <span className="ml-auto text-[10px] text-muted">
                      {f.run_count} run{f.run_count === 1 ? "" : "s"}
                      {tab === "public" && ` · by ${authorName(f)}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
