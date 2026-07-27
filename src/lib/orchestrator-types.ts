import type { Category } from "@/lib/models";

export type OrchestratorStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * One planned unit of work — maps almost 1:1 onto the body Autopilot posts
 * to the existing `/api/generate/[category]` route for that step. Stored as
 * an element of `orchestrator_runs.plan` (a jsonb array), not a separate DB
 * table — see the migration's doc comment for why.
 */
export interface OrchestratorStep {
  /** Stable position in the plan array — used for `referenceFromStep` pointers and React keys. Absolute across the whole thread (never reset per follow-up), never reordered once planned. */
  index: number;
  /** Short human label for the UI, e.g. "Generate the hero shot". */
  label: string;
  category: Category;
  modelId: string;
  prompt: string;
  /** Passed straight through as `settings` to the existing generate API (aspectRatio, duration, resolution, etc). */
  settings?: Record<string, unknown>;
  /** Index of an earlier step ANYWHERE in this thread's plan (an earlier turn or this same one) whose first completed output becomes this step's reference image/video — null/undefined = no dependency. */
  referenceFromStep?: number | null;
  /** Fixed image URLs the user attached to the message that introduced this step (via the @ reference picker) — distinct from `referenceFromStep`, which chains a *prior step's own output* instead of something the user uploaded/picked directly. */
  referenceUrls?: string[] | null;
  status: OrchestratorStepStatus;
  generationId?: string | null;
  /** First output URL of this step's own completed generation — cached here once known so a later step that references this one (via its `referenceFromStep`) can read it straight off the plan array instead of re-querying `generations`. */
  outputUrl?: string | null;
  error?: string | null;
  costUsd?: number | null;
}

export type OrchestratorMessageRole = "user" | "assistant";

/**
 * One turn in the thread's transcript — display-only, doesn't drive
 * execution (that's `plan`, a flat array shared across every turn). A user
 * message is the brief/follow-up text they typed (plus any @-referenced
 * image URLs); an assistant message is Autopilot's response introducing the
 * steps it just planned, pointed at by `stepIndices`.
 */
export interface OrchestratorMessage {
  role: OrchestratorMessageRole;
  text: string;
  createdAt: string;
  /** Images attached via the @ reference picker on a user message. */
  referenceUrls?: string[];
  /** Which absolute indices into `plan` this message introduced (assistant messages only). */
  stepIndices?: number[];
}

export type OrchestratorRunStatus =
  | "planning"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type OrchestratorMode = "assistant" | "autopilot";

export interface OrchestratorRun {
  id: string;
  user_id: string;
  project_id: string | null;
  /** Fixed at creation. "assistant" = plain conversational chat, no plan/steps/cost/approval. "autopilot" = the full plan -> approve -> execute flow. */
  mode: OrchestratorMode;
  /** The thread's opening brief/message — the actual first turn. Later turns live in `messages`, not here. */
  brief: string;
  /** Short (2-3 word) LLM-generated name for the Chats rail, generated once at creation from `brief`. Null for older rows (predate this column) or if generation failed — both fall back to showing `brief` (truncated) instead. */
  title: string | null;
  /** Every step across the whole thread, oldest first — never reset by a follow-up, only appended to. */
  plan: OrchestratorStep[];
  /** Full conversation transcript — see OrchestratorMessage. */
  messages: OrchestratorMessage[];
  /** Which muapi LLM endpoint plans this thread — see lib/plannerModels.ts. */
  planner_model: string;
  status: OrchestratorRunStatus;
  total_cost_usd: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
