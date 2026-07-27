"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Maximize,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Check,
  X,
  Minus,
  Undo2,
  Redo2,
  Settings,
  Search,
  Wand2,
  Copy,
  RefreshCw,
  StickyNote,
  Group as GroupIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadReferenceFile } from "@/lib/upload";
import { DEFAULT_MODEL_ID, modelsByCategory, getModel } from "@/lib/models";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/models";
import type { Space, SpaceGraph, SpaceNode, GenerateNode, SpaceEdge } from "@/lib/space-types";

const NODE_W = 252;
const PORT_Y = 34;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Text value a node contributes to a downstream generate node's prompt. */
function nodeText(n: SpaceNode): string {
  if (n.type === "text") return (n.data as { text: string }).text || "";
  if (n.type === "assistant") return (n.data as { outputText?: string }).outputText || "";
  if (n.type === "list") {
    const d = n.data as { lines?: string[] };
    return (d.lines ?? []).filter(Boolean).join("\n");
  }
  return "";
}
/** Image/media URL a node contributes as a reference. */
function nodeUrl(n: SpaceNode): string | null {
  if (n.type === "image") return (n.data as { url: string | null }).url;
  if (n.type === "generate") return (n.data as { outputUrl?: string }).outputUrl ?? null;
  return null;
}

function nodeLabel(n: SpaceNode): string {
  return (n.data as { label?: string }).label || n.type;
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a node's prompt against its wired-in inputs, the way Magnific's
 * Prompt node does: `@Label` tokens are replaced inline with that connected
 * node's text (longest labels first so multi-word names win). Any connected
 * text/list/assistant node NOT explicitly referenced is appended at the end
 * (so it still works if you don't use @). Connected image / generate outputs
 * always become the reference images. Returns the final prompt + references.
 */
function resolvePrompt(promptText: string, inbound: SpaceNode[]): { prompt: string; refs: string[] } {
  const textNodes = inbound.filter((n) => n.type === "text" || n.type === "list" || n.type === "assistant");
  const labelMap = new Map<string, string>();
  for (const n of textNodes) labelMap.set(nodeLabel(n), nodeText(n));
  let prompt = promptText || "";
  const used = new Set<string>();
  for (const lbl of [...labelMap.keys()].sort((a, b) => b.length - a.length)) {
    const re = new RegExp("@" + escapeRegExp(lbl) + "(?![\\w])", "gi");
    if (re.test(prompt)) {
      prompt = prompt.replace(re, labelMap.get(lbl) || "");
      used.add(lbl);
    }
  }
  const extra = textNodes.filter((n) => !used.has(nodeLabel(n))).map(nodeText).filter(Boolean);
  const finalPrompt = [prompt, ...extra].filter(Boolean).join("\n\n").trim();
  const refs = inbound.map(nodeUrl).filter((u): u is string => !!u);
  return { prompt: finalPrompt, refs };
}

export function SpaceEditor({ space }: { space: Space }) {
  const router = useRouter();
  const [name, setName] = useState(space.name);
  const [graph, setGraph] = useState<SpaceGraph>(space.graph ?? { nodes: [], edges: [] });
  const [view, setView] = useState({ x: 60, y: 60, scale: 1 });
  const [saved, setSaved] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ id: string; cx0: number; cy0: number; w0: number; h0: number; axis: "both" | "y" } | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const connectRef = useRef<{ source: string } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [connectPos, setConnectPos] = useState<{ x: number; y: number } | null>(null);
  const [connecting, setConnecting] = useState(false); // drives target-node highlight

  const markDirty = useCallback(() => setSaved(false), []);

  // ── undo / redo ──────────────────────────────────────────────────────
  // Snapshots are taken on structural changes (add/delete node/edge, connect,
  // drag end) — not on every keystroke, so undo granularity stays useful.
  const [past, setPast] = useState<SpaceGraph[]>([]);
  const [future, setFuture] = useState<SpaceGraph[]>([]);
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-49), graphRef.current]);
    setFuture([]);
  }, []);
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [graphRef.current, ...f]);
      setGraph(p[p.length - 1]);
      markDirty();
      return p.slice(0, -1);
    });
  }, [markDirty]);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, graphRef.current]);
      setGraph(f[0]);
      markDirty();
      return f.slice(1);
    });
  }, [markDirty]);

  // ── canvas chrome state ──────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [edgeStyle, setEdgeStyle] = useState<"bezier" | "straight">("bezier");

  // keyboard: ⌘/Ctrl+Z undo, +Shift redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const updateNode = useCallback(
    (id: string, patch: Partial<SpaceNode["data"]>) => {
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as SpaceNode) : n)),
      }));
      markDirty();
    },
    [markDirty]
  );

  const save = useCallback(async () => {
    await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, graph: graphRef.current }),
    });
    setSaved(true);
  }, [space.id, name]);

  useEffect(() => {
    if (saved) return;
    const t = setTimeout(() => save(), 1000);
    return () => clearTimeout(t);
  }, [graph, name, saved, save]);

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const r = containerRef.current?.getBoundingClientRect();
      return {
        x: (clientX - (r?.left ?? 0) - view.x) / view.scale,
        y: (clientY - (r?.top ?? 0) - view.y) / view.scale,
      };
    },
    [view]
  );

  // pointer move/up: node drag, pan, connect. Connecting uses hit-testing on
  // drop (elementFromPoint → nearest [data-node-id]) so you can release
  // anywhere on a target node, not on a tiny dot — how real canvases work.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (resizeRef.current) {
        const c = toCanvas(e.clientX, e.clientY);
        const { id, cx0, cy0, w0, h0, axis } = resizeRef.current;
        const w = axis === "both" ? Math.max(200, w0 + (c.x - cx0)) : w0;
        const h = Math.max(120, h0 + (c.y - cy0));
        setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? ({ ...n, w, h } as SpaceNode) : n)) }));
        return;
      }
      if (dragRef.current) {
        const c = toCanvas(e.clientX, e.clientY);
        const { id, dx, dy } = dragRef.current;
        setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x: c.x - dx, y: c.y - dy } : n)) }));
      } else if (panRef.current) {
        const p = panRef.current;
        setView((v) => ({ ...v, x: p.vx + (e.clientX - p.x), y: p.vy + (e.clientY - p.y) }));
      } else if (connectRef.current) {
        setConnectPos(toCanvas(e.clientX, e.clientY));
      }
    }
    function onUp() {
      if (dragRef.current || resizeRef.current) markDirty();
      dragRef.current = null;
      resizeRef.current = null;
      panRef.current = null;
      if (connectRef.current) {
        const src = connectRef.current.source;
        const { x, y } = lastPointerRef.current;
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const targetId = el?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
        connectRef.current = null;
        setConnecting(false);
        setConnectPos(null);
        if (targetId && targetId !== src) {
          const target = graphRef.current.nodes.find((n) => n.id === targetId);
          if (target && (target.type === "generate" || target.type === "assistant")) {
            pushHistory();
            setGraph((g) =>
              g.edges.some((ed) => ed.source === src && ed.target === targetId)
                ? g
                : { ...g, edges: [...g.edges, { id: uid(), source: src, target: targetId }] }
            );
            markDirty();
          }
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [toCanvas, markDirty, pushHistory]);

  function onWheel(e: React.WheelEvent) {
    // zoom toward the cursor
    const r = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  }

  function addNode(type: SpaceNode["type"]) {
    pushHistory();
    setPaletteOpen(false);
    const r = containerRef.current?.getBoundingClientRect();
    const center = toCanvas((r?.left ?? 0) + (r?.width ?? 800) / 2, (r?.top ?? 0) + (r?.height ?? 500) / 2);
    const base = { id: uid(), x: center.x - NODE_W / 2 + Math.random() * 40, y: center.y - 60 + Math.random() * 40 };
    let node: SpaceNode;
    if (type === "image") node = { ...base, type, data: { url: null, label: "Image" } };
    else if (type === "text") node = { ...base, type, data: { text: "", label: "Text" } };
    else if (type === "list") node = { ...base, type, data: { lines: [""], label: "List" } };
    else if (type === "assistant") node = { ...base, type, data: { instruction: "", status: "idle", label: "Assistant" } };
    else if (type === "note") node = { ...base, type, w: 210, h: 190, data: { text: "", label: "Note" } };
    else if (type === "group") node = { ...base, x: center.x - 170, y: center.y - 130, type, w: 340, h: 260, data: { label: "New group" } };
    else node = { ...base, type, data: { category: "image", modelId: DEFAULT_MODEL_ID.image ?? "", prompt: "", status: "idle", label: "Generate" } };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
    markDirty();
  }

  function deleteNode(id: string) {
    pushHistory();
    setGraph((g) => ({ nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.source !== id && e.target !== id) }));
    markDirty();
  }
  function deleteEdge(id: string) {
    pushHistory();
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }));
    markDirty();
  }
  /** Clone a node (offset a little) — its wires are not copied, matching Magnific. */
  function duplicateNode(id: string) {
    pushHistory();
    setGraph((g) => {
      const n = g.nodes.find((x) => x.id === id);
      if (!n) return g;
      const copy = { ...n, id: uid(), x: n.x + 28, y: n.y + 28, data: { ...n.data } } as SpaceNode;
      return { ...g, nodes: [...g.nodes, copy] };
    });
    markDirty();
  }
  function fitView() {
    const nodes = graph.nodes;
    if (nodes.length === 0) {
      setView({ x: 60, y: 60, scale: 1 });
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W));
    const maxY = Math.max(...nodes.map((n) => n.y + 260));
    const r = containerRef.current!.getBoundingClientRect();
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((r.width - 80) / (maxX - minX), (r.height - 80) / (maxY - minY), 1)));
    setView({ scale, x: (r.width - (maxX - minX) * scale) / 2 - minX * scale, y: (r.height - (maxY - minY) * scale) / 2 - minY * scale });
  }

  async function runNode(id: string): Promise<void> {
    const node = graphRef.current.nodes.find((n) => n.id === id) as GenerateNode | undefined;
    if (!node || node.type !== "generate") return;
    const inbound = graphRef.current.edges.filter((e) => e.target === id).map((e) => graphRef.current.nodes.find((n) => n.id === e.source)).filter((n): n is SpaceNode => !!n);
    const { prompt, refs } = resolvePrompt(node.data.prompt, inbound);
    if (!prompt && refs.length === 0) {
      updateNode(id, { status: "failed", error: "Wire in a prompt or reference first" });
      return;
    }
    updateNode(id, { status: "running", error: null });
    try {
      const res = await fetch(`/api/generate/${node.data.category}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: node.data.modelId, prompt, references: refs, settings: node.data.settings ?? {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const genId: string = data.id ?? data.generation?.id;
      updateNode(id, { generationId: genId });
      const supabase = createClient();
      const url = await new Promise<string>((resolve, reject) => {
        const started = Date.now();
        const iv = setInterval(async () => {
          const { data: row } = await supabase.from("generations").select("status, output_urls, error").eq("id", genId).maybeSingle();
          if (row?.status === "completed" && row.output_urls?.[0]) {
            clearInterval(iv);
            resolve(row.output_urls[0]);
          } else if (row?.status === "failed") {
            clearInterval(iv);
            reject(new Error(row.error || "Generation failed"));
          } else if (Date.now() - started > 4 * 60_000) {
            clearInterval(iv);
            reject(new Error("Timed out"));
          }
        }, 2000);
      });
      updateNode(id, { outputUrl: url, status: "done" });
    } catch (err) {
      updateNode(id, { status: "failed", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function runAssistant(id: string): Promise<void> {
    const node = graphRef.current.nodes.find((n) => n.id === id);
    if (!node || node.type !== "assistant") return;
    const inbound = graphRef.current.edges.filter((e) => e.target === id).map((e) => graphRef.current.nodes.find((n) => n.id === e.source)).filter((n): n is SpaceNode => !!n);
    // Resolve @refs in the instruction too, then feed the combined text.
    const { prompt: context } = resolvePrompt(node.data.instruction || "", inbound);
    updateNode(id, { status: "running", error: null });
    try {
      const res = await fetch("/api/prompt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          category: "image",
          draft: context,
          message: context.trim()
            ? "Combine the above into one concise, vivid image prompt."
            : "Write one concise, vivid image prompt.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant failed");
      updateNode(id, { outputText: (data.reply ?? "").trim(), status: "done" });
    } catch (err) {
      updateNode(id, { status: "failed", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  /** Dispatch a node's Run button to the right runner. */
  function runAny(id: string) {
    const n = graphRef.current.nodes.find((x) => x.id === id);
    if (n?.type === "assistant") return runAssistant(id);
    return runNode(id);
  }

  async function runAll() {
    // topological order over generate nodes (generate -> generate deps)
    const gens = graph.nodes.filter((n) => n.type === "generate");
    const deps = new Map<string, string[]>();
    gens.forEach((g) => deps.set(g.id, graph.edges.filter((e) => e.target === g.id).map((e) => e.source).filter((s) => gens.some((x) => x.id === s))));
    const done = new Set<string>();
    const order: string[] = [];
    let guard = 0;
    while (order.length < gens.length && guard++ < 100) {
      for (const g of gens) {
        if (done.has(g.id)) continue;
        if ((deps.get(g.id) ?? []).every((d) => done.has(d))) {
          order.push(g.id);
          done.add(g.id);
        }
      }
    }
    setRunningAll(true);
    for (const id of order) await runNode(id);
    setRunningAll(false);
  }

  function outPort(n: SpaceNode) {
    return { x: n.x + (n.w ?? NODE_W), y: n.y + PORT_Y };
  }
  function inPort(n: SpaceNode) {
    return { x: n.x, y: n.y + PORT_Y };
  }
  function path(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (edgeStyle === "straight") return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  const NODE_TYPES: { type: SpaceNode["type"]; label: string; desc: string; icon: typeof ImageIcon }[] = [
    { type: "image", label: "Image", desc: "An image input / reference", icon: ImageIcon },
    { type: "text", label: "Text", desc: "Freeform text — style, subject…", icon: TypeIcon },
    { type: "list", label: "List", desc: "A list of options to combine", icon: ListChecks },
    { type: "assistant", label: "Assistant", desc: "LLM that refines wired-in text into a prompt", icon: Wand2 },
    { type: "generate", label: "Generate", desc: "Produce an image / video / audio", icon: Sparkles },
    { type: "note", label: "Sticky note", desc: "A note to annotate your canvas", icon: StickyNote },
    { type: "group", label: "Group", desc: "A titled frame to organise nodes", icon: GroupIcon },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle/60 shrink-0">
        <button onClick={() => router.push("/spaces")} className="icon-btn-round" title="Back to Spaces">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          className="min-w-0 flex-1 max-w-xs bg-transparent text-sm font-medium outline-none"
        />
        <span className="text-[11px] text-muted">{saved ? "Saved" : "Saving…"}</span>
        <button onClick={runAll} disabled={runningAll} className="ml-auto flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/20 disabled:opacity-50" title="Run every step in order">
          {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run all
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden pixel-grid-bg cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) {
            panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
            setPaletteOpen(false);
          }
        }}
      >
        <div className="absolute left-0 top-0 origin-top-left" data-bg="1" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <svg className="absolute" style={{ overflow: "visible", left: 0, top: 0, width: 1, height: 1 }}>
            {graph.edges.map((e: SpaceEdge) => {
              const a = graph.nodes.find((n) => n.id === e.source);
              const b = graph.nodes.find((n) => n.id === e.target);
              if (!a || !b) return null;
              const d = path(outPort(a), inPort(b));
              return (
                <g key={e.id}>
                  <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.75} />
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} className="cursor-pointer" style={{ pointerEvents: "stroke" }} onClick={() => deleteEdge(e.id)}>
                    <title>Click to remove connection</title>
                  </path>
                </g>
              );
            })}
            {connecting && connectPos && (() => {
              const a = graph.nodes.find((n) => n.id === connectRef.current?.source);
              return a ? <path d={path(outPort(a), connectPos)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" /> : null;
            })()}
          </svg>

          {[...graph.nodes]
            .sort((a, b) => (a.type === "group" ? -1 : 0) - (b.type === "group" ? -1 : 0))
            .map((node) => {
            const dragProps = {
              onHeaderDown: (e: React.PointerEvent) => {
                const c = toCanvas(e.clientX, e.clientY);
                dragRef.current = { id: node.id, dx: c.x - node.x, dy: c.y - node.y };
              },
              onResizeDown: (e: React.PointerEvent, axis: "both" | "y") => {
                pushHistory();
                const c = toCanvas(e.clientX, e.clientY);
                resizeRef.current = { id: node.id, cx0: c.x, cy0: c.y, w0: node.w ?? NODE_W, h0: node.h ?? 200, axis };
              },
              onDelete: () => deleteNode(node.id),
              onDuplicate: () => duplicateNode(node.id),
              onUpdate: (patch: Partial<SpaceNode["data"]>) => updateNode(node.id, patch),
            };
            if (node.type === "group") return <GroupCard key={node.id} node={node} {...dragProps} />;
            if (node.type === "note") return <NoteCard key={node.id} node={node} {...dragProps} />;
            const isTarget = connecting && (node.type === "generate" || node.type === "assistant") && node.id !== connectRef.current?.source;
            const inputLabels = graph.edges
              .filter((e) => e.target === node.id)
              .map((e) => graph.nodes.find((n) => n.id === e.source))
              .filter((n): n is SpaceNode => !!n && (n.type === "text" || n.type === "list" || n.type === "assistant"))
              .map((n) => nodeLabel(n));
            return (
              <NodeCard
                key={node.id}
                node={node}
                isDropTarget={!!isTarget}
                inputLabels={inputLabels}
                onHeaderDown={(e) => {
                  const c = toCanvas(e.clientX, e.clientY);
                  dragRef.current = { id: node.id, dx: c.x - node.x, dy: c.y - node.y };
                }}
                onOutDown={() => {
                  connectRef.current = { source: node.id };
                  setConnecting(true);
                  setConnectPos({ x: node.x + (node.w ?? NODE_W), y: node.y + PORT_Y });
                }}
                onResizeDown={(e, axis) => {
                  pushHistory();
                  const c = toCanvas(e.clientX, e.clientY);
                  resizeRef.current = {
                    id: node.id,
                    cx0: c.x,
                    cy0: c.y,
                    w0: node.w ?? NODE_W,
                    h0: node.h ?? (node.type === "generate" && node.data.outputUrl ? 340 : 220),
                    axis,
                  };
                }}
                onDelete={() => deleteNode(node.id)}
                onDuplicate={() => duplicateNode(node.id)}
                onUpdate={(patch) => updateNode(node.id, patch)}
                onRun={() => runAny(node.id)}
              />
            );
          })}
        </div>

        {graph.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-muted">
            <Sparkles className="h-6 w-6" />
            <p className="text-sm">Click + to add a node. Drag an output dot onto a Generate/Assistant node to connect.</p>
          </div>
        )}

        {/* Left tool rail */}
        <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface/90 backdrop-blur p-1 shadow-lg">
          <button onClick={() => setPaletteOpen((v) => !v)} className={cn("icon-btn-round h-8 w-8", paletteOpen && "bg-surface-2")} title="Add node">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={runAll} disabled={runningAll} className="icon-btn-round h-8 w-8 disabled:opacity-50" title="Run all">
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={fitView} className="icon-btn-round h-8 w-8" title="Fit to view">
            <Maximize className="h-4 w-4" />
          </button>
          <div className="mx-1 my-0.5 border-t border-border-subtle" />
          <button onClick={undo} disabled={past.length === 0} className="icon-btn-round h-8 w-8 disabled:opacity-40" title="Undo (⌘Z)">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} disabled={future.length === 0} className="icon-btn-round h-8 w-8 disabled:opacity-40" title="Redo (⌘⇧Z)">
            <Redo2 className="h-4 w-4" />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="icon-btn-round h-8 w-8" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Add-node palette */}
        {paletteOpen && (
          <div className="absolute left-16 top-3 w-64 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-2xl">
            <div className="mb-1 flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted" />
              <span className="text-xs text-muted">Add a node</span>
            </div>
            {NODE_TYPES.map((t) => (
              <button key={t.type} onClick={() => addNode(t.type)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
                <t.icon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{t.label}</span>
                  <span className="block text-[10px] text-muted truncate">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* zoom control */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-border-subtle bg-surface/90 backdrop-blur px-1 py-1 shadow-lg">
          <button onClick={() => setView((v) => ({ ...v, scale: Math.max(MIN_SCALE, v.scale / 1.15) }))} className="icon-btn-round h-7 w-7" title="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted">{Math.round(view.scale * 100)}%</span>
          <button onClick={() => setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * 1.15) }))} className="icon-btn-round h-7 w-7" title="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={fitView} className="icon-btn-round h-7 w-7" title="Fit to view">
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Canvas settings</span>
              <button onClick={() => setSettingsOpen(false)} className="icon-btn-round" title="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Connection style</span>
              <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-0.5">
                {(["bezier", "straight"] as const).map((s) => (
                  <button key={s} onClick={() => setEdgeStyle(s)} className={cn("rounded-md px-2.5 py-1 text-xs capitalize", edgeStyle === s ? "bg-surface-2 text-foreground" : "text-muted")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted">Tip: press ⌘Z / ⌘⇧Z to undo &amp; redo. Scroll to zoom, drag the canvas to pan.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Port({ side, onDown }: { side: "in" | "out"; onDown?: (e: React.PointerEvent) => void }) {
  return (
    <span
      onPointerDown={(e) => {
        if (side === "out") {
          e.stopPropagation();
          onDown?.(e);
        }
      }}
      className={cn(
        "absolute h-4 w-4 rounded-full border-2 border-surface bg-accent transition-transform hover:scale-125",
        side === "in" ? "-left-2 cursor-default" : "-right-2 cursor-crosshair"
      )}
      style={{ top: PORT_Y - 8 }}
      title={side === "in" ? "Input — drop a connection here" : "Output — drag onto a Generate/Assistant node"}
    />
  );
}

function NodeCard({
  node, isDropTarget, inputLabels, onHeaderDown, onOutDown, onResizeDown, onDelete, onDuplicate, onUpdate, onRun,
}: {
  node: SpaceNode;
  isDropTarget: boolean;
  inputLabels: string[];
  onHeaderDown: (e: React.PointerEvent) => void;
  onOutDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent, axis: "both" | "y") => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (patch: Partial<SpaceNode["data"]>) => void;
  onRun: () => void;
}) {
  const Icon = node.type === "image" ? ImageIcon : node.type === "text" ? TypeIcon : node.type === "list" ? ListChecks : node.type === "assistant" ? Wand2 : Sparkles;
  const label = (node.data as { label?: string }).label ?? node.type;
  const takesInput = node.type === "generate" || node.type === "assistant";
  const canRun = node.type === "generate" || node.type === "assistant";
  const status = (node.data as { status?: string }).status;
  const sized = node.h != null; // user has explicitly resized → fill the card
  const width = node.w ?? NODE_W;
  return (
    <div
      data-node-id={node.id}
      className={cn(
        "group/node absolute rounded-xl border bg-surface shadow-lg transition-shadow",
        sized && "flex flex-col",
        isDropTarget ? "border-accent ring-2 ring-accent/40" : "border-border-subtle"
      )}
      style={{ left: node.x, top: node.y, width, height: node.h }}
    >
      {/* hover toolbar (Magnific-style) */}
      <div className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border-subtle bg-surface/95 px-1 py-0.5 opacity-0 shadow-xl backdrop-blur transition-opacity group-hover/node:opacity-100">
        {canRun && (
          <button onClick={onRun} disabled={status === "running"} className="icon-btn-round h-7 w-7 disabled:opacity-50" title="Run">
            {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        )}
        <button onClick={onDuplicate} className="icon-btn-round h-7 w-7" title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="icon-btn-round h-7 w-7 hover:text-danger-text" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div onPointerDown={onHeaderDown} className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border-subtle cursor-move select-none shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted shrink-0" />
        <input
          value={label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold uppercase tracking-wide text-muted outline-none"
        />
        <button onClick={onDelete} className="text-muted hover:text-danger-text shrink-0" title="Delete node">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {takesInput && <Port side="in" />}
      <Port side="out" onDown={onOutDown} />

      <div className={cn("p-2.5", sized && "flex-1 min-h-0 flex flex-col overflow-hidden")}>
        {node.type === "image" && <ImageBody node={node} fill={sized} onUpdate={onUpdate} />}
        {node.type === "text" && (
          <textarea
            value={(node.data as { text: string }).text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Style notes, elements, a subject…"
            rows={4}
            className={cn("w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent", sized && "flex-1")}
          />
        )}
        {node.type === "list" && <ListBody node={node} onUpdate={onUpdate} />}
        {node.type === "assistant" && <AssistantBody node={node} inputLabels={inputLabels} onUpdate={onUpdate} onRun={onRun} />}
        {node.type === "generate" && <GenerateBody node={node} inputLabels={inputLabels} fill={sized} onUpdate={onUpdate} onRun={onRun} />}
      </div>

      {/* bottom-edge expand grip — appears on hover, drags height */}
      <div
        onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e, "y"); }}
        className="absolute -bottom-1 left-1/2 h-2.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-full opacity-0 transition-opacity group-hover/node:opacity-100"
        title="Drag to expand"
      >
        <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-border-subtle" />
      </div>
      {/* bottom-right corner — resize width + height */}
      <div
        onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e, "both"); }}
        className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize opacity-0 transition-opacity group-hover/node:opacity-100"
        title="Drag to resize"
      >
        <div className="absolute bottom-1 right-1 h-2 w-2 rounded-sm border-b-2 border-r-2 border-muted" />
      </div>
    </div>
  );
}

/** Small hover toolbar shared by Group / Note cards (duplicate + delete). */
function MiniToolbar({ onDuplicate, onDelete, extra }: { onDuplicate: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  return (
    <div className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border-subtle bg-surface/95 px-1 py-0.5 opacity-0 shadow-xl backdrop-blur transition-opacity group-hover/node:opacity-100">
      {extra}
      <button onClick={onDuplicate} className="icon-btn-round h-7 w-7" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} className="icon-btn-round h-7 w-7 hover:text-danger-text" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/** Bottom-edge + corner resize grips shared by Group / Note cards. */
function ResizeGrips({ onResizeDown }: { onResizeDown: (e: React.PointerEvent, axis: "both" | "y") => void }) {
  return (
    <>
      <div onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e, "y"); }} className="absolute -bottom-1 left-1/2 h-2.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-full opacity-0 transition-opacity group-hover/node:opacity-100" title="Drag to expand">
        <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-border-subtle" />
      </div>
      <div onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e, "both"); }} className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize opacity-0 transition-opacity group-hover/node:opacity-100" title="Drag to resize">
        <div className="absolute bottom-1 right-1 h-2 w-2 rounded-sm border-b-2 border-r-2 border-muted" />
      </div>
    </>
  );
}

/** A titled group frame — organises a canvas. Renders behind other nodes;
 * drag it by its title bar. Not part of any flow (no ports). */
function GroupCard({ node, onHeaderDown, onResizeDown, onDelete, onDuplicate, onUpdate }: {
  node: SpaceNode & { type: "group" };
  onHeaderDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent, axis: "both" | "y") => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (patch: Partial<SpaceNode["data"]>) => void;
}) {
  return (
    <div
      data-node-id={node.id}
      className="group/node absolute rounded-2xl border-2 border-dashed border-accent/40 bg-accent/[0.04]"
      style={{ left: node.x, top: node.y, width: node.w ?? 340, height: node.h ?? 260, zIndex: 0 }}
    >
      <MiniToolbar onDuplicate={onDuplicate} onDelete={onDelete} />
      <div onPointerDown={onHeaderDown} className="flex cursor-move select-none items-center gap-1.5 px-3 py-2">
        <GroupIcon className="h-3.5 w-3.5 shrink-0 text-accent/80" />
        <input
          value={node.data.label ?? "New group"}
          onChange={(e) => onUpdate({ label: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
        />
      </div>
      <div className="pointer-events-none flex h-[calc(100%-40px)] items-center justify-center text-[11px] text-muted">
        Drag nodes over this frame to group them
      </div>
      <ResizeGrips onResizeDown={onResizeDown} />
    </div>
  );
}

const NOTE_COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e5e7eb"];

/** A sticky note — freeform annotation. Drag by the top strip; type in the body. */
function NoteCard({ node, onHeaderDown, onResizeDown, onDelete, onDuplicate, onUpdate }: {
  node: SpaceNode & { type: "note" };
  onHeaderDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent, axis: "both" | "y") => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (patch: Partial<SpaceNode["data"]>) => void;
}) {
  const bg = node.data.color ?? NOTE_COLORS[0];
  return (
    <div
      data-node-id={node.id}
      className="group/node absolute flex flex-col rounded-md shadow-lg"
      style={{ left: node.x, top: node.y, width: node.w ?? 210, height: node.h ?? 190, backgroundColor: bg }}
    >
      <MiniToolbar
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        extra={
          <div className="flex items-center gap-0.5 pr-1">
            {NOTE_COLORS.map((c) => (
              <button key={c} onClick={() => onUpdate({ color: c })} className={cn("h-4 w-4 rounded-full border", node.data.color === c || (!node.data.color && c === NOTE_COLORS[0]) ? "border-foreground" : "border-black/20")} style={{ backgroundColor: c }} title="Note colour" />
            ))}
          </div>
        }
      />
      <div onPointerDown={onHeaderDown} className="h-4 shrink-0 cursor-move rounded-t-md" />
      <textarea
        value={node.data.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Write a note…"
        className="flex-1 min-h-0 w-full resize-none bg-transparent px-3 text-[13px] leading-snug text-black/80 outline-none placeholder:text-black/40"
      />
      {node.data.author && <div className="px-3 pb-2 text-[10px] italic text-black/50">{node.data.author}</div>}
      <ResizeGrips onResizeDown={onResizeDown} />
    </div>
  );
}

/** Clickable @Name chips for the connected input nodes — click to insert the
 * reference into the prompt, exactly like Magnific's Prompt node. */
function RefChips({ labels, onInsert }: { labels: string[]; onInsert: (label: string) => void }) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <button
          key={l}
          onClick={() => onInsert(l)}
          className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/25"
          title={`Insert @${l}`}
        >
          @{l}
        </button>
      ))}
    </div>
  );
}

function AssistantBody({ node, inputLabels, onUpdate, onRun }: { node: SpaceNode & { type: "assistant" }; inputLabels: string[]; onUpdate: (p: Partial<SpaceNode["data"]>) => void; onRun: () => void }) {
  const status = node.data.status ?? "idle";
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={node.data.instruction}
        onChange={(e) => onUpdate({ instruction: e.target.value })}
        placeholder="How should it combine the inputs? Reference them with @name…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
      />
      <RefChips labels={inputLabels} onInsert={(l) => onUpdate({ instruction: `${node.data.instruction || ""}${node.data.instruction && !node.data.instruction.endsWith(" ") ? " " : ""}@${l} ` })} />
      {node.data.outputText && (
        <div className="rounded-lg border border-border-subtle bg-surface-2/60 px-2 py-1.5 text-[11px] text-foreground/90 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {node.data.outputText}
        </div>
      )}
      {node.data.error && <div className="text-[11px] text-danger-text">{node.data.error}</div>}
      <button
        onClick={onRun}
        disabled={status === "running"}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
          status === "done" ? "bg-surface-2 text-foreground border border-border-subtle" : "bg-accent text-white hover:bg-accent-2"
        )}
      >
        {status === "running" ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</>) : status === "done" ? (<><Check className="h-3.5 w-3.5" /> Run again</>) : (<><Wand2 className="h-3.5 w-3.5" /> Run</>)}
      </button>
    </div>
  );
}

function ImageBody({ node, fill, onUpdate }: { node: SpaceNode & { type: "image" }; fill?: boolean; onUpdate: (p: Partial<SpaceNode["data"]>) => void }) {
  const [uploading, setUploading] = useState(false);
  async function pick(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadReferenceFile(file);
      onUpdate({ url });
    } finally {
      setUploading(false);
    }
  }
  return node.data.url ? (
    <div className={cn("relative", fill && "flex-1 min-h-0")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={node.data.url} alt="" className={cn("w-full rounded-lg", fill ? "h-full object-contain" : "object-cover max-h-40")} />
      <button onClick={() => onUpdate({ url: null })} className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white" title="Remove">
        <X className="h-3 w-3" />
      </button>
    </div>
  ) : (
    <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-subtle bg-surface-2 px-2 py-4 text-xs text-muted hover:text-foreground">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Upload image
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
    </label>
  );
}

function ListBody({ node, onUpdate }: { node: SpaceNode & { type: "list" }; onUpdate: (p: Partial<SpaceNode["data"]>) => void }) {
  const lines = node.data.lines ?? [""];
  const set = (next: string[]) => onUpdate({ lines: next.length ? next : [""] });
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={line}
            onChange={(e) => set(lines.map((l, j) => (j === i ? e.target.value : l)))}
            placeholder={`Option ${i + 1}`}
            className="min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs outline-none placeholder:text-muted focus:border-accent"
          />
          <button onClick={() => set(lines.filter((_, j) => j !== i))} className="text-muted hover:text-danger-text" title="Remove">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button onClick={() => set([...lines, ""])} className="flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] text-muted hover:text-foreground">
        <Plus className="h-3 w-3" /> Add option
      </button>
    </div>
  );
}

function GenerateBody({ node, inputLabels, fill, onUpdate, onRun }: { node: GenerateNode; inputLabels: string[]; fill?: boolean; onUpdate: (p: Partial<SpaceNode["data"]>) => void; onRun: () => void }) {
  const models = modelsByCategory(node.data.category);
  const status = node.data.status ?? "idle";
  const model = getModel(node.data.modelId);
  const hasOutput = !!node.data.outputUrl;
  const isImg = node.data.category === "image";
  return (
    <div className={cn("flex flex-col gap-2", fill && "flex-1 min-h-0")}>
      <div className="flex gap-1.5 shrink-0">
        <select
          value={node.data.category}
          onChange={(e) => { const category = e.target.value as Category; onUpdate({ category, modelId: DEFAULT_MODEL_ID[category] ?? modelsByCategory(category)[0]?.id ?? "" }); }}
          className="rounded-md border border-border-subtle bg-surface-2 px-1.5 py-1 text-[11px] outline-none"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
        </select>
        <select
          value={node.data.modelId}
          onChange={(e) => onUpdate({ modelId: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-1 text-[11px] outline-none"
        >
          {models.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
          {!model && <option value={node.data.modelId}>{node.data.modelId || "Pick a model"}</option>}
        </select>
      </div>
      <textarea
        value={node.data.prompt}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        placeholder="Prompt — reference inputs with @name…"
        rows={2}
        className="w-full shrink-0 resize-none rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
      />
      <RefChips labels={inputLabels} onInsert={(l) => onUpdate({ prompt: `${node.data.prompt || ""}${node.data.prompt && !node.data.prompt.endsWith(" ") ? " " : ""}@${l} ` })} />

      {/* Output display — Magnific "Output" node: the result front and centre */}
      {hasOutput && (
        <div className={cn("group/out relative overflow-hidden rounded-lg border border-border-subtle bg-black/40", fill && "flex-1 min-h-0")}>
          {node.data.category === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={node.data.outputUrl!} controls loop muted className={cn("w-full rounded-lg", fill ? "h-full object-contain" : "max-h-56")} />
          ) : node.data.category === "audio" ? (
            <div className="p-2">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={node.data.outputUrl!} controls className="w-full" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.data.outputUrl!} alt="" className={cn("w-full rounded-lg", fill ? "h-full object-contain" : "object-cover max-h-56")} />
          )}
          {isImg && (
            <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {(model?.label ?? "Output")}
            </span>
          )}
          {/* regenerate — circular control, bottom-right, like Magnific */}
          <button
            onClick={onRun}
            disabled={status === "running"}
            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/out:opacity-100 disabled:opacity-50"
            title="Regenerate"
          >
            {status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {node.data.error && <div className="text-[11px] text-danger-text shrink-0">{node.data.error}</div>}
      <button
        onClick={onRun}
        disabled={status === "running"}
        className={cn(
          "flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
          hasOutput ? "bg-surface-2 text-foreground border border-border-subtle" : "bg-accent text-white hover:bg-accent-2"
        )}
      >
        {status === "running" ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>) : hasOutput ? (<><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>) : (<><Play className="h-3.5 w-3.5" /> Run</>)}
      </button>
    </div>
  );
}
