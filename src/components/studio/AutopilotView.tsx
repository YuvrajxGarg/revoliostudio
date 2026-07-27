"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Check,
  Clapperboard,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Music2,
  Play,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { SaveFlowModal } from "@/components/flows/SaveFlowModal";
import { formatCostUSD, formatCostINR } from "@/lib/pricing";
import { formatErrorMessage } from "@/lib/errorFormat";
import { cn } from "@/lib/utils";
import { useGenerations } from "@/hooks/useGenerations";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { DEFAULT_LLM_MODEL } from "@/lib/llmModels";
import { LlmModelSelector } from "@/components/studio/LlmModelSelector";
import { AutopilotReferencePicker, type AutopilotReference } from "@/components/studio/AutopilotReferencePicker";
import type { OrchestratorMessage, OrchestratorMode, OrchestratorRun, OrchestratorStep } from "@/lib/orchestrator-types";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

const POLL_INTERVAL_MS = 2000;

const EXAMPLE_BRIEFS: Record<OrchestratorMode, string[]> = {
  autopilot: [
    "Make a moody product shot of a coffee bag, then turn it into a 5 second cinematic ad clip",
    "Generate a fantasy character portrait, then remove the background so I can drop it on anything",
    "Create a short looping video of a sneaker rotating on a pedestal, then upscale it",
  ],
  assistant: [
    "What's the difference between an i2v and a t2v video model?",
    "Give me 5 creative angles for a sneaker product launch",
    "Help me tighten up this caption for an Instagram post",
  ],
};

const MODE_META: Record<OrchestratorMode, { label: string; blurb: string; icon: typeof Zap }> = {
  autopilot: {
    label: "Autopilot",
    blurb: "Plans real generation steps, shows the cost, and runs them once you approve.",
    icon: Zap,
  },
  assistant: {
    label: "Assistant",
    blurb: "A normal conversation — brainstorm, ask questions, get feedback. Doesn't generate anything itself.",
    icon: MessageCircle,
  },
};

function CategoryIcon({ category }: { category: OrchestratorStep["category"] }) {
  if (category === "video") return <Clapperboard className="h-3.5 w-3.5" />;
  if (category === "audio") return <Music2 className="h-3.5 w-3.5" />;
  return <ImageIcon className="h-3.5 w-3.5" />;
}

function StepStatusIcon({ status }: { status: OrchestratorStep["status"] }) {
  if (status === "completed") return <Check className="h-3.5 w-3.5 text-white" />;
  if (status === "failed") return <X className="h-3.5 w-3.5 text-white" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-muted" />;
}

function StepRow({ step }: { step: OrchestratorStep }) {
  // Local to this row — the result thumbnail's "view full size" just needs a
  // bare lightbox, not anything shared with sibling steps or the rest of the
  // chat.
  const [viewingResult, setViewingResult] = useState(false);
  return (
    <div className="flex gap-3 rounded-xl border border-border-subtle bg-surface-2 p-3">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
          step.status === "completed" && "bg-accent",
          step.status === "failed" && "bg-danger",
          step.status === "running" && "bg-accent/70",
          step.status === "pending" && "bg-surface border border-border-subtle"
        )}
      >
        {step.status === "pending" ? (
          <span className="text-[10px] font-semibold text-muted">{step.index + 1}</span>
        ) : (
          <StepStatusIcon status={step.status} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{step.label}</span>
          <span className="flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-muted border border-border-subtle">
            <CategoryIcon category={step.category} /> {step.modelId}
          </span>
          {step.costUsd != null && (
            <span className="text-[10px] text-muted">
              {formatCostUSD(step.costUsd)} · {formatCostINR(step.costUsd)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{step.prompt}</p>
        {step.referenceFromStep != null && (
          <p className="mt-0.5 text-[10px] text-muted">Uses the result of step {step.referenceFromStep + 1}</p>
        )}
        {step.referenceUrls && step.referenceUrls.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] text-muted mr-0.5">Using:</span>
            {step.referenceUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Reference ${i + 1}`}
                title="Attached reference image used for this step"
                className="h-7 w-7 rounded-md object-cover border border-border-subtle"
              />
            ))}
          </div>
        )}
        {step.status === "failed" && step.error && (
          <p className="mt-1 text-[11px] text-danger-text">{formatErrorMessage(step.error).message}</p>
        )}
        {step.status === "completed" && step.outputUrl && (
          <button
            onClick={() => setViewingResult(true)}
            className="mt-2 block h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border-subtle hover:border-accent/50 transition-colors"
            title="Click to view full size"
          >
            {step.category === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={step.outputUrl} muted className="h-full w-full object-cover" />
            ) : step.category === "audio" ? (
              <div className="h-full w-full flex items-center justify-center bg-surface">
                <Music2 className="h-5 w-5 text-muted" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={step.outputUrl} alt={step.label} className="h-full w-full object-cover" />
            )}
          </button>
        )}
      </div>

      {viewingResult && step.outputUrl && (
        <ImageLightbox
          url={step.outputUrl}
          mediaType={step.category === "video" ? "video" : step.category === "audio" ? "audio" : "image"}
          onClose={() => setViewingResult(false)}
        />
      )}
    </div>
  );
}

/** Shown in place of Pilot's reply while a send is in flight — see the `pendingTurn` state in AutopilotView. */
function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border-subtle bg-surface-2 px-3.5 py-2.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
        <span className="text-sm text-muted">{label}</span>
      </div>
    </div>
  );
}

/** A plain chat bubble — Assistant mode's user/reply turns. */
function ChatBubble({ message }: { message: OrchestratorMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5",
          isUser ? "rounded-tr-sm bg-accent/10 border border-accent/20" : "rounded-tl-sm bg-surface-2 border border-border-subtle"
        )}
      >
        {message.referenceUrls && message.referenceUrls.length > 0 && (
          <div className="mb-1.5 flex gap-1.5">
            {message.referenceUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Image ${i + 1}`} className="h-10 w-10 rounded-md object-cover border border-border-subtle" />
            ))}
          </div>
        )}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
}

/** One turn in an Autopilot thread — a user message (text + attached reference thumbnails) or an assistant message (its short reply + the steps it introduced, with Run/Discard actions if that batch is still pending). */
function PlanTurn({
  message,
  steps,
  isLastActionable,
  onApprove,
  onDiscard,
  busy,
}: {
  message: OrchestratorMessage;
  steps: OrchestratorStep[];
  isLastActionable: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  if (message.role === "user") return <ChatBubble message={message} />;

  const pendingCost = steps.filter((s) => s.status === "pending").reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  const hasPending = steps.some((s) => s.status === "pending");

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] flex flex-col gap-2">
        <p className="text-xs text-muted px-1">{message.text}</p>
        <div className="flex flex-col gap-2">
          {steps.map((step) => (
            <StepRow key={step.index} step={step} />
          ))}
        </div>
        {isLastActionable && hasPending && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
            <span className="text-xs text-muted">
              Will cost {formatCostUSD(pendingCost)} · {formatCostINR(pendingCost)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onDiscard}
                disabled={busy}
                className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-border-subtle disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeToggle({ value, onChange, disabled }: { value: OrchestratorMode; onChange: (m: OrchestratorMode) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface-2 p-0.5">
      {(Object.keys(MODE_META) as OrchestratorMode[]).map((m) => {
        const meta = MODE_META[m];
        const Icon = meta.icon;
        return (
          <button
            key={m}
            onClick={() => !disabled && onChange(m)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              value === m ? "bg-accent text-white" : "text-muted hover:text-foreground",
              disabled && value !== m && "opacity-50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pilot — Revolio's own AI copilot, in two modes. Assistant is a plain
 * conversational LLM chat (pick any of muapi's 25 chat models, no
 * generation ability). Autopilot is Revolio's take on Higgsfield's
 * "Supercomputer": describe a brief, an LLM plans a short multi-step
 * sequence using the real model registry, you see the cost upfront and
 * approve each batch, and it executes through the same
 * /api/generate/[category] path every composer already uses. Deliberately
 * scoped to just this planning/execution core — no Skills marketplace,
 * memory, scheduling, or external connectors.
 */
export function AutopilotView({ canSaveFlow = false }: { canSaveFlow?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<OrchestratorMode>("autopilot");
  const [saveFlowOpen, setSaveFlowOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [references, setReferences] = useState<AutopilotReference[]>([]);
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<OrchestratorRun | null>(null);
  const [history, setHistory] = useState<OrchestratorRun[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  // Optimistic view of the message just sent on an existing thread — shown
  // immediately (with a "Pilot is thinking…" bubble below it) instead of
  // leaving the composer sitting on the typed text until the whole
  // plan/reply round-trip finishes. Cleared once the real activeRun lands
  // (or the request fails). Only used for follow-ups on an existing
  // thread — a brand-new thread has no message pane yet to append into.
  const [pendingTurn, setPendingTurn] = useState<OrchestratorMessage | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Shared by both the landing-screen textarea and the in-thread follow-up
  // textarea — only one is ever mounted at a time (they're in mutually
  // exclusive branches below), so one ref + one auto-grow effect covers
  // both. Grows the box to fit typed content (like a normal chat input)
  // instead of staying a fixed number of rows regardless of prompt length;
  // capped by the max-h/overflow-y-auto set on each textarea's className
  // below so a very long brief falls back to scrolling rather than growing
  // forever.
  const briefTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = briefTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [brief]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrator");
      if (res.ok) setHistory(await res.json());
    } catch {
      // Best-effort — the main conversation flow doesn't depend on history loading.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Deep-link: /autopilot?run=<id> opens that run directly — used by "Run
  // flow", which seeds an awaiting-approval Autopilot run and sends the
  // runner here to review the cost and execute it.
  const runParam = params.get("run");
  useEffect(() => {
    if (!runParam) return;
    let cancelled = false;
    fetch(`/api/orchestrator/${runParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((run) => {
        if (!cancelled && run) setActiveRun(run as OrchestratorRun);
      });
    return () => {
      cancelled = true;
    };
  }, [runParam]);

  useEffect(() => {
    if (activeRun) {
      setLlmModel(activeRun.planner_model || DEFAULT_LLM_MODEL);
      setMode(activeRun.mode);
    }
  }, [activeRun?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeRun?.messages?.length, activeRun?.plan, pendingTurn]);

  // Poll the active run while it's actually in flight — same interval-based
  // pattern as useGenerations' own job polling. Assistant-mode replies land
  // immediately (no execution to poll), so this only ever fires in Autopilot mode.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!activeRun || activeRun.status !== "running") return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/orchestrator/${activeRun.id}`);
      if (res.ok) {
        const updated = (await res.json()) as OrchestratorRun;
        setActiveRun(updated);
        if (updated.status !== "running") loadHistory();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRun, loadHistory]);

  function addReference(url: string) {
    setReferences((prev) => [...prev, { id: crypto.randomUUID(), url }]);
  }
  function removeReference(id: string) {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  }
  function updateReferenceTag(id: string, tag: string) {
    setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, tag } : r)));
  }

  async function handleSend() {
    if (planning || !brief.trim()) return;
    const text = brief.trim();
    const draftReferences = references;
    const referenceUrls = draftReferences.map((r) => r.url);
    // Sent to the server as {url, tag?} — the tag is either what the user
    // typed for that image or left blank for Pilot to auto-caption before
    // planning (see tagUntaggedReferences in lib/orchestrator.ts). Keeping
    // referenceUrls as a plain string[] too since that's still what gets
    // stored on the message for display (ChatBubble/StepRow only render URLs).
    const referencePayload = draftReferences.map((r) => ({ url: r.url, tag: r.tag?.trim() || undefined }));

    setPlanning(true);
    setError(null);
    // Clear the composer and show the message immediately instead of
    // leaving it sitting in the (now disabled) textarea until the whole
    // response comes back. This used to only fire when a thread already
    // existed (`if (activeRun)`) — a brand-new thread had no message pane to
    // append into, so it just sat on the landing screen with "Planning…" /
    // "Thinking…" stuck on the send button. Setting it unconditionally lets
    // `showConversation` (true whenever there's a pendingTurn, not just an
    // activeRun) switch straight into the chat transcript view for the very
    // first message too, with this bubble plus a ThinkingBubble shown below
    // it — matching how every other LLM chat UI behaves.
    setPendingTurn({
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      referenceUrls: referenceUrls.length ? referenceUrls : undefined,
    });
    setBrief("");
    setReferences([]);

    try {
      const res = await fetch(activeRun ? `/api/orchestrator/${activeRun.id}/message` : "/api/orchestrator/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeRun
            ? { text, references: referencePayload }
            : { brief: text, plannerModel: llmModel, references: referencePayload, mode }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reach Pilot");
      setActiveRun(data as OrchestratorRun);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Nothing was lost — restore the draft so the user isn't stuck retyping it.
      setBrief(text);
      setReferences(draftReferences);
    } finally {
      setPendingTurn(null);
      setPlanning(false);
    }
  }

  async function handleApprove() {
    if (!activeRun || busyAction) return;
    setBusyAction(true);
    setError(null);
    try {
      const res = await fetch(`/api/orchestrator/${activeRun.id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start this run");
      setActiveRun(data as OrchestratorRun);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleDiscard() {
    if (!activeRun || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/orchestrator/${activeRun.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (data && "deleted" in data && data.deleted) {
        setActiveRun(null);
      } else if (data?.id) {
        setActiveRun(data as OrchestratorRun);
      }
      loadHistory();
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCancelRunning() {
    if (!activeRun || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/orchestrator/${activeRun.id}/cancel`, { method: "POST" });
      if (res.ok) setActiveRun(await res.json());
      loadHistory();
    } finally {
      setBusyAction(false);
    }
  }

  function startNewChat() {
    setActiveRun(null);
    setBrief("");
    setReferences([]);
    setError(null);
    setPendingTurn(null);
  }

  const isAutopilot = (activeRun?.mode ?? mode) === "autopilot";
  const composerDisabled = planning || busyAction || activeRun?.status === "running";
  // A brand-new thread has no activeRun yet the moment Send is pressed — the
  // first response is still in flight. Without this, the view stayed on the
  // landing "What can Pilot help with today?" screen with only the send
  // button's own label swapping to "Planning…"/"Thinking…" until the whole
  // round-trip finished, instead of behaving like a normal chat (message
  // shown immediately, assistant side shows a thinking indicator). Treating
  // "there's a pendingTurn" the same as "there's an activeRun" for the
  // purposes of which screen to show fixes that.
  const showConversation = Boolean(activeRun) || Boolean(pendingTurn);

  // Group the thread's messages with the plan steps each assistant turn
  // introduced (Autopilot mode only — Assistant mode's messages have no
  // steps), and find the very last assistant turn (the only one that can
  // still have an actionable "pending" batch to approve/discard).
  const turns = (activeRun?.messages ?? []).map((m) => ({
    message: m,
    steps: (m.stepIndices ?? [])
      .map((i) => activeRun!.plan.find((s) => s.index === i))
      .filter((s): s is OrchestratorStep => Boolean(s)),
  }));
  const lastAssistantTurnIndex = [...turns].map((t, i) => (t.message.role === "assistant" ? i : -1)).filter((i) => i >= 0).pop();

  return (
    <div className="flex-1 flex min-h-0 gap-3 px-3 pb-3 pt-3">
      {/* Thread rail */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-hidden">
        <button
          onClick={startNewChat}
          className="flex items-center gap-1.5 m-2 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs font-medium hover:bg-border-subtle transition-colors"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
        </button>
        <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Chats</div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
          {history.length === 0 && <p className="px-1.5 py-4 text-xs text-muted text-center">Nothing yet.</p>}
          {history.map((run) => {
            const ModeIcon = MODE_META[run.mode ?? "autopilot"].icon;
            return (
              <button
                key={run.id}
                onClick={() => setActiveRun(run)}
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  activeRun?.id === run.id ? "bg-surface-2" : "hover:bg-surface-2/60"
                )}
              >
                <ModeIcon className="h-3 w-3 mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-xs truncate">{run.title || run.brief}</span>
                  <span
                    className={cn(
                      "text-[10px] capitalize",
                      run.status === "completed" && "text-accent",
                      run.status === "failed" && "text-danger-text",
                      run.status === "running" && "text-accent",
                      (run.status === "awaiting_approval" || run.status === "cancelled") && "text-muted"
                    )}
                  >
                    {run.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border-subtle/60 bg-surface/30 backdrop-blur-md shadow-lg overflow-hidden">
        {!showConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4">
            <div className="text-center">
              <h1 className="flex items-center justify-center gap-1.5 text-xl font-semibold">
                <Bot className="h-5 w-5 text-accent" /> What can Pilot help with today?
              </h1>
              <p className="mt-1.5 text-sm text-muted leading-relaxed max-w-md">{MODE_META[mode].blurb}</p>
            </div>
            <ModeToggle value={mode} onChange={setMode} />
            <div className="w-full max-w-xl rounded-2xl border border-border-subtle bg-surface p-3 flex flex-col gap-2">
              <AutopilotReferencePicker
                references={references}
                onAdd={addReference}
                onRemove={removeReference}
                onTagChange={updateReferenceTag}
              />
              <textarea
                ref={briefTextareaRef}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  mode === "autopilot"
                    ? "e.g. Make a product photo of my headphones, then turn it into a 5 second ad clip"
                    : "Ask Pilot anything…"
                }
                rows={3}
                disabled={planning}
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted max-h-56 overflow-y-auto"
              />
              <div className="flex items-center justify-between gap-2">
                <LlmModelSelector value={llmModel} onChange={setLlmModel} disabled={planning} />
                <button
                  onClick={handleSend}
                  disabled={planning || !brief.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-2 transition-colors"
                >
                  {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  {planning ? (mode === "autopilot" ? "Planning…" : "Thinking…") : mode === "autopilot" ? "Plan it" : "Send"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_BRIEFS[mode].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setBrief(ex)}
                    disabled={planning}
                    className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-50"
                  >
                    {ex.length > 46 ? `${ex.slice(0, 43)}…` : ex}
                  </button>
                ))}
              </div>
              {error && <div className="text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle/60 shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                {isAutopilot ? <Zap className="h-4 w-4 text-accent shrink-0" /> : <MessageCircle className="h-4 w-4 text-accent shrink-0" />}
                <span className="text-sm font-medium truncate">{activeRun?.brief ?? pendingTurn?.text ?? "New chat"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isAutopilot && activeRun && activeRun.total_cost_usd != null && activeRun.total_cost_usd > 0 && (
                  <span className="text-[11px] text-muted">
                    Total: {formatCostUSD(activeRun.total_cost_usd)} · {formatCostINR(activeRun.total_cost_usd)}
                  </span>
                )}
                {activeRun?.status === "running" && (
                  <button
                    onClick={handleCancelRunning}
                    disabled={busyAction}
                    className="rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-medium hover:bg-border-subtle disabled:opacity-50"
                  >
                    Stop
                  </button>
                )}
                {canSaveFlow && isAutopilot && activeRun && activeRun.plan.length > 0 && (
                  <button
                    onClick={() => setSaveFlowOpen(true)}
                    title="Save this plan as a reusable Flow"
                    className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-medium hover:bg-border-subtle transition-colors"
                  >
                    <Workflow className="h-3 w-3" /> Save as Flow
                  </button>
                )}
                {isAutopilot && activeRun && (
                  <button
                    onClick={() => router.push("/gallery")}
                    className="hidden md:flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Library
                  </button>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-4">
              {isAutopilot
                ? turns.map((t, i) => (
                    <PlanTurn
                      key={i}
                      message={t.message}
                      steps={t.steps}
                      isLastActionable={i === lastAssistantTurnIndex && activeRun?.status === "awaiting_approval"}
                      onApprove={handleApprove}
                      onDiscard={handleDiscard}
                      busy={busyAction}
                    />
                  ))
                : (activeRun?.messages ?? []).map((m, i) => <ChatBubble key={i} message={m} />)}
              {pendingTurn && (
                <>
                  <ChatBubble message={pendingTurn} />
                  <ThinkingBubble label={isAutopilot ? "Planning the next steps…" : "Thinking…"} />
                </>
              )}
              {activeRun?.error && (activeRun.status === "failed" || activeRun.status === "running") && (
                <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger-text">
                  {formatErrorMessage(activeRun.error).message}
                </div>
              )}
            </div>

            <div className="px-4 md:px-6 pb-4 pt-2 shrink-0">
              <div className="rounded-2xl border border-border-subtle bg-surface p-3 flex flex-col gap-2">
                <AutopilotReferencePicker
                  references={references}
                  onAdd={addReference}
                  onRemove={removeReference}
                  onTagChange={updateReferenceTag}
                />
                <textarea
                  ref={briefTextareaRef}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    activeRun?.status === "running" ? "Wait for the current step to finish…" : "Send a follow-up…"
                  }
                  rows={2}
                  disabled={composerDisabled}
                  className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-50 max-h-56 overflow-y-auto"
                />
                <div className="flex items-center justify-between gap-2">
                  <LlmModelSelector
                    value={llmModel}
                    onChange={setLlmModel}
                    disabled
                    disabledReason="This thread's model is locked in — start a new chat to pick a different one"
                  />
                  <button
                    onClick={handleSend}
                    disabled={composerDisabled || !brief.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-accent-2 transition-colors"
                  >
                    {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="mt-1.5 text-xs text-danger-text">{formatErrorMessage(error).message}</div>}
            </div>
          </>
        )}
      </div>

      {/* Results gallery — Autopilot mode only, nothing to show in Assistant mode */}
      {isAutopilot && <AutopilotGallery projectId={activeRun?.project_id ?? null} />}

      {saveFlowOpen && activeRun && (
        <SaveFlowModal
          steps={activeRun.plan}
          defaultName={activeRun.title ?? activeRun.brief}
          onClose={() => setSaveFlowOpen(false)}
          onSaved={() => {
            setSaveFlowOpen(false);
            router.push("/flows");
          }}
        />
      )}
    </div>
  );
}

/**
 * Persistent grid of everything this thread's Project has generated so far
 * — Supercomputer's right-hand gallery panel. Scoped by project rather than
 * by tool_id "autopilot" so switching threads shows only that thread's own
 * results, not every Autopilot run's output mixed together. Before a thread
 * has ever been approved (no project yet), there's nothing to scope to, so
 * it's queried against a sentinel id that can never match a real project —
 * cheaper than teaching useGenerations a "don't fetch anything" mode just
 * for this one panel.
 */
function AutopilotGallery({ projectId }: { projectId: string | null }) {
  const { items, loading, hasMore, loadMore } = useGenerations(undefined, {
    projectId: projectId || "no-active-autopilot-project",
  });

  return (
    <aside className="hidden xl:flex w-[300px] shrink-0 flex-col rounded-2xl border border-border-subtle/60 bg-surface/50 backdrop-blur-md shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border-subtle/60 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Gallery
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {!projectId ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
            <ImageIcon className="h-5 w-5" />
            <p className="text-xs max-w-[10rem]">Results will show up here once Autopilot starts generating.</p>
          </div>
        ) : (
          <GenerationGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            emptyLabel="Nothing generated yet."
            columnWidth={130}
          />
        )}
      </div>
    </aside>
  );
}
