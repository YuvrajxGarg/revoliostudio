-- Character Sheet — one reference photo -> a full studio character sheet
-- (Revolio's own take on Higgsfield's "CharLock" app): a vision-LLM-extracted
-- metadata card (age/ethnicity/height/build/eyes/hair/skinTone/
-- distinguishingMarks/style/anchorPhrase) plus 24 separate consistent-
-- character generations (5 head angles, 6 full-body poses, 3 detail crops,
-- 6 expressions, 4 lighting variants), composited into one poster client-side
-- (never persisted server-side in v1 — see the Character Sheet plan).
--
-- One row per sheet. Like orchestrator_runs, the 24 generation "slots" live
-- in a `slots` jsonb array rather than a child table — they're never queried
-- independently of their sheet, always rewritten as a whole array as each
-- slot's own generation resolves, and there's no reporting need to slice
-- across sheets by individual slot.
create table if not exists public.character_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_face_url text not null,
  quality text not null default 'compact' check (quality in ('compact', 'studio')),
  -- { age, ethnicity, height, build, eyes, hair, skinTone, distinguishingMarks, style, anchorPhrase } — null until the vision-LLM call resolves.
  metadata jsonb,
  -- Array of slot objects: { index, section, label, prompt, status
  -- (queued|processing|completed|failed), generationId, outputUrl, error }.
  -- See src/lib/characterSheet-types.ts for the authoritative shape.
  slots jsonb not null default '[]'::jsonb,
  status text not null default 'analyzing'
    check (status in ('analyzing', 'generating', 'completed', 'failed')),
  total_cost_usd numeric,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists character_sheets_user_idx
  on public.character_sheets (user_id, created_at desc);

alter table public.character_sheets enable row level security;

drop policy if exists "users read own character sheets" on public.character_sheets;
create policy "users read own character sheets"
  on public.character_sheets for select using (auth.uid() = user_id);

drop policy if exists "users insert own character sheets" on public.character_sheets;
create policy "users insert own character sheets"
  on public.character_sheets for insert with check (auth.uid() = user_id);

drop policy if exists "users update own character sheets" on public.character_sheets;
create policy "users update own character sheets"
  on public.character_sheets for update using (auth.uid() = user_id);

drop policy if exists "users delete own character sheets" on public.character_sheets;
create policy "users delete own character sheets"
  on public.character_sheets for delete using (auth.uid() = user_id);

-- Reuses the shared trigger fn from 0001_init.sql.
drop trigger if exists character_sheets_touch_updated_at on public.character_sheets;
create trigger character_sheets_touch_updated_at
  before update on public.character_sheets
  for each row execute function public.touch_updated_at();
