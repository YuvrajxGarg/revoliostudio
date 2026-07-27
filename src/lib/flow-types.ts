import type { OrchestratorStep } from "@/lib/orchestrator-types";

/**
 * A Flow — a reusable, shareable multi-step workflow (Revolio's take on
 * Magnific Flows). It's a snapshot of an Autopilot plan (`steps`) plus one
 * named input; running it seeds a fresh Autopilot run with those steps, the
 * runner's input substituted in (see /api/flows/[id]/run). The "builder" is
 * whoever saved it from an Autopilot run; a "runner" just supplies the input.
 */
export interface Flow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  /** What the runner is asked to provide, e.g. "Product name". */
  input_label: string;
  /** The pipeline — OrchestratorStep[] with runtime fields reset. */
  steps: OrchestratorStep[];
  /** Which step's prompt receives the runner input (also used as a hint). */
  input_step_index: number;
  is_public: boolean;
  published_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
  /** Joined author info on public flows (Community tab). Optional. */
  author?: { display_name: string | null; email: string | null } | null;
}

/** The token that, wherever it appears in a step prompt, is replaced by the
 * runner's input at run time. If absent, the input is appended to the
 * `input_step_index` step's prompt instead. */
export const FLOW_INPUT_TOKEN = "{{input}}";
