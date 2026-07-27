-- Revolio Autopilot — the "type a brief, get a planned multi-step run"
-- orchestrator (Revolio's own take on Higgsfield's "Supercomputer": core
-- planning agent only — no Skills marketplace, connectors, or scheduling in
-- this pass, see the build-recommendation discussion for why).
--
-- One row per run. The plan itself (an ordered array of steps — each a
-- category/model/prompt/settings + which prior step's output feeds it, if
-- any) lives in the `plan` jsonb column rather than a child table: steps are
-- never queried independently of their run, always rewritten as a whole
-- array when a step's status changes, and there's no reporting need to slice
-- across runs by individual step — a child table would just add join
-- overhead for zero benefit here.
create table if not exists public.orchestrator_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Created lazily on first run (see src/app/api/orchestrator/[id]/run/route.ts)
  -- so every run's resulting generations land in one place, same as manually
  -- creating a project and filing generations into it yourself.
  project_id uuid references public.projects (id) on delete set null,
  brief text not null,
  -- Array of step objects: { label, category, modelId, prompt, settings,
  -- referenceFromStep (index into this array, or null), status
  -- (pending|running|completed|failed), generationId, error, costUsd }.
  -- See src/lib/orchestrator-types.ts for the authoritative shape.
  plan jsonb not null default '[]'::jsonb,
  status text not null default 'planning'
    check (status in ('planning', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled')),
  total_cost_usd numeric,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orchestrator_runs_user_idx
  on public.orchestrator_runs (user_id, created_at desc);

alter table public.orchestrator_runs enable row level security;

drop policy if exists "users read own orchestrator runs" on public.orchestrator_runs;
create policy "users read own orchestrator runs"
  on public.orchestrator_runs for select using (auth.uid() = user_id);

drop policy if exists "users insert own orchestrator runs" on public.orchestrator_runs;
create policy "users insert own orchestrator runs"
  on public.orchestrator_runs for insert with check (auth.uid() = user_id);

drop policy if exists "users update own orchestrator runs" on public.orchestrator_runs;
create policy "users update own orchestrator runs"
  on public.orchestrator_runs for update using (auth.uid() = user_id);

drop policy if exists "users delete own orchestrator runs" on public.orchestrator_runs;
create policy "users delete own orchestrator runs"
  on public.orchestrator_runs for delete using (auth.uid() = user_id);

-- Reuses the shared trigger fn from 0001_init.sql.
drop trigger if exists orchestrator_runs_touch_updated_at on public.orchestrator_runs;
create trigger orchestrator_runs_touch_updated_at
  before update on public.orchestrator_runs
  for each row execute function public.touch_updated_at();
