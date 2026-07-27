import type { Category } from "@/lib/models";

/** Node kinds on a Space canvas. */
export type SpaceNodeType = "image" | "text" | "list" | "assistant" | "generate" | "note" | "group";

export interface SpaceNodeBase {
  id: string;
  type: SpaceNodeType;
  x: number;
  y: number;
  /** Optional explicit size (px) — set when the user drags to resize/expand a
   * node, e.g. to view a generated output large. Falls back to defaults. */
  w?: number;
  h?: number;
}

/** An image input — an uploaded/picked reference that feeds generate nodes. */
export interface ImageNode extends SpaceNodeBase {
  type: "image";
  data: { url: string | null; label?: string };
}

/** A text block — style notes, elements, a subject, etc. Feeds a prompt. */
export interface TextNode extends SpaceNodeBase {
  type: "text";
  data: { text: string; label?: string };
}

/** A list of options (Scenario, placements, styles…) — its non-empty lines
 * are joined and fed into a downstream generate node's prompt. */
export interface ListNode extends SpaceNodeBase {
  type: "list";
  data: { lines: string[]; label?: string };
}

/** An Assistant (LLM) node — combines/refines wired-in text into a single
 * prompt via the language model. Its output text feeds a downstream generate
 * node (this is Magnific's "Prompt" node). */
export interface AssistantNode extends SpaceNodeBase {
  type: "assistant";
  data: {
    label?: string;
    instruction: string;
    outputText?: string;
    status?: "idle" | "running" | "done" | "failed";
    error?: string | null;
  };
}

/** A generation step. Its prompt is the node's own text plus any wired-in
 * text nodes; wired-in image / generate nodes become its references. */
export interface GenerateNode extends SpaceNodeBase {
  type: "generate";
  data: {
    label?: string;
    category: Category;
    modelId: string;
    prompt: string;
    settings?: Record<string, unknown>;
    // runtime
    generationId?: string | null;
    outputUrl?: string | null;
    status?: "idle" | "running" | "done" | "failed";
    error?: string | null;
  };
}

/** A sticky note — freeform annotation on the canvas. Not wired into anything. */
export interface NoteNode extends SpaceNodeBase {
  type: "note";
  data: { text: string; color?: string; author?: string; label?: string };
}

/** A group frame — a titled container you drop nodes onto to organise a canvas.
 * Purely visual (renders behind other nodes); it does not wire into a flow. */
export interface GroupNode extends SpaceNodeBase {
  type: "group";
  data: { label?: string; color?: string };
}

export type SpaceNode = ImageNode | TextNode | ListNode | AssistantNode | GenerateNode | NoteNode | GroupNode;

/** A wire from one node's output into another node (a generate node). */
export interface SpaceEdge {
  id: string;
  source: string;
  target: string;
}

export interface SpaceGraph {
  nodes: SpaceNode[];
  edges: SpaceEdge[];
}

export interface Space {
  id: string;
  user_id: string;
  name: string;
  graph: SpaceGraph;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
