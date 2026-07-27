-- Revolio Studio — Flows: reusable, shareable multi-step workflows.
-- A Flow is a snapshot of an Autopilot plan (its steps) plus a single named
-- input; running a Flow seeds a fresh Autopilot run with those steps, the
-- runner's input substituted in, ready to review + run. Run in the Supabase
-- SQL editor (or `supabase db push`).

create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  -- What the runner is asked to provide, e.g. "Product name" / "Subject".
  input_label text not null default 'Input',
  -- The plan snapshot — an OrchestratorStep[] (see orchestrator-types.ts),
  -- with runtime fields (status/generationId/outputUrl/error) reset.
  steps jsonb not null default '[]'::jsonb,
  -- Which step's prompt receives the runner's input (also used as a hint;
  -- the `{{input}}` token in any step prompt is replaced everywhere too).
  input_step_index int not null default 0,
  is_public boolean not null default false,
  published_at timestamptz,
  run_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flows_user_idx on public.flows (user_id, created_at desc);
create index if not exists flows_public_idx on public.flows (published_at desc) where is_public;

alter table public.flows enable row level security;

drop policy if exists "owner manages flows" on public.flows;
create policy "owner manages flows"
  on public.flows for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anyone (signed-in) can read a published flow — powers the Community Flows
-- tab and lets a runner open/personalize someone else's flow.
drop policy if exists "read published flows" on public.flows;
create policy "read published flows"
  on public.flows for select
  to authenticated
  using (is_public = true);

-- keep updated_at fresh
create or replace function public.touch_flows_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists flows_touch_updated_at on public.flows;
create trigger flows_touch_updated_at
  before update on public.flows
  for each row execute function public.touch_flows_updated_at();
