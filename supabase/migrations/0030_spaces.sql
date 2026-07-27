-- Revolio Studio — Spaces: node-based generative workflows. A Space is a
-- graph of nodes (image inputs, text, generate) and edges wiring outputs into
-- generate steps. Flows (0029) are the "saved & shareable" layer that lives
-- alongside Spaces in the same hub. Run in the Supabase SQL editor.

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Untitled space' check (char_length(name) between 1 and 160),
  -- { nodes: SpaceNode[], edges: SpaceEdge[] } — see lib/space-types.ts.
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spaces_user_idx on public.spaces (user_id, updated_at desc);
create index if not exists spaces_public_idx on public.spaces (published_at desc) where is_public;

alter table public.spaces enable row level security;

drop policy if exists "owner manages spaces" on public.spaces;
create policy "owner manages spaces"
  on public.spaces for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "read published spaces" on public.spaces;
create policy "read published spaces"
  on public.spaces for select
  to authenticated
  using (is_public = true);

create or replace function public.touch_spaces_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists spaces_touch_updated_at on public.spaces;
create trigger spaces_touch_updated_at
  before update on public.spaces
  for each row execute function public.touch_spaces_updated_at();
