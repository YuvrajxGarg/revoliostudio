-- Turns Autopilot's orchestrator_runs from one-shot ("brief -> single plan")
-- into a multi-turn thread: a user can send a follow-up after seeing a plan
-- or a finished result, and Autopilot appends new steps onto the same run
-- instead of starting over. `plan` keeps accumulating every step across the
-- whole thread (see src/lib/orchestratorRun.ts — it already just scans for
-- the next pending/running step in order, so appending "just works" without
-- touching the execution engine); `messages` is the display-facing
-- transcript of what was said in each turn.

alter table public.orchestrator_runs
  add column if not exists messages jsonb not null default '[]'::jsonb;

-- Which muapi LLM endpoint planned this thread — see src/lib/plannerModels.ts
-- for the selectable options. Stored per-run (not per-message) so switching
-- the model mid-conversation is remembered and shown in the history rail.
alter table public.orchestrator_runs
  add column if not exists planner_model text not null default 'gemini-2-5-flash';
