-- Splits Pilot (formerly "Autopilot") into two modes sharing the same
-- thread table: "assistant" (a plain conversational LLM chat — no plan, no
-- steps, no cost/approval flow, replies land immediately) and "autopilot"
-- (the existing plan -> approve -> execute flow). A thread's mode is fixed
-- at creation, same as its planner_model.
alter table public.orchestrator_runs
  add column if not exists mode text not null default 'autopilot'
    check (mode in ('assistant', 'autopilot'));
