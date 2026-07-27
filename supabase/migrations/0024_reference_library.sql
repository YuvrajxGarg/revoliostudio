-- Revolio Studio — Reference Library: a Magnific-style browsable picker for
-- Style / Character / Location / Element image references, plus Camera /
-- Effects / Color prompt-modifier tags. Two tables:
--   curated_references — admin-curated, everyone browses (same shape as
--     the existing `resources` bank: ships empty, admin fills it via the
--     Reference Library admin tab rather than a seeded starter set, since
--     unlike `resources` (which links to real external tools/sites) these
--     need actual representative photos we don't have a free source for).
--   user_references — a signed-in user's own saved, named, reusable
--     references ("my brand style", "@sarah") — same per-user RLS shape
--     as the existing `templates` table.

-- ── curated_references ──────────────────────────────────────────────────
create table if not exists public.curated_references (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('style','character','location','element','camera','effects','color')),
  name text not null,
  image_url text,
  thumbnail_url text,
  -- Text appended to the prompt when this entry is picked. Required for
  -- camera/effects/color (which are pure prompt modifiers, no image), and
  -- optional flavor text for the image categories (style/character/
  -- location/element) on top of the reference image itself.
  prompt_modifier text,
  -- Color-category only: an ordered hex palette rendered as swatches
  -- instead of a photo (e.g. {#e8a4c8,#161616,#f5f0e8,#7a0e0e}).
  swatch_colors text[] not null default '{}',
  tags text[] not null default '{}',
  sort_order int not null default 100,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists curated_references_category_idx
  on public.curated_references (category, sort_order, created_at desc);

alter table public.curated_references enable row level security;

drop policy if exists "authenticated users read curated references" on public.curated_references;
create policy "authenticated users read curated references"
  on public.curated_references for select using (auth.role() = 'authenticated');
drop policy if exists "admins insert curated references" on public.curated_references;
create policy "admins insert curated references"
  on public.curated_references for insert with check (public.is_admin());
drop policy if exists "admins update curated references" on public.curated_references;
create policy "admins update curated references"
  on public.curated_references for update using (public.is_admin());
drop policy if exists "admins delete curated references" on public.curated_references;
create policy "admins delete curated references"
  on public.curated_references for delete using (public.is_admin());

-- ── user_references ─────────────────────────────────────────────────────
-- Only the four image-based categories are save-able as "your own" — camera/
-- effects/color are just tag picks, nothing to persist per-user for those.
create table if not exists public.user_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('style','character','location','element')),
  name text not null,
  image_url text not null,
  source text not null default 'upload' check (source in ('upload','generation')),
  created_at timestamptz not null default now(),
  unique (user_id, category, name)
);

create index if not exists user_references_user_idx
  on public.user_references (user_id, category, created_at desc);

alter table public.user_references enable row level security;

drop policy if exists "users read own references" on public.user_references;
create policy "users read own references"
  on public.user_references for select using (auth.uid() = user_id);
drop policy if exists "users insert own references" on public.user_references;
create policy "users insert own references"
  on public.user_references for insert with check (auth.uid() = user_id);
drop policy if exists "users update own references" on public.user_references;
create policy "users update own references"
  on public.user_references for update using (auth.uid() = user_id);
drop policy if exists "users delete own references" on public.user_references;
create policy "users delete own references"
  on public.user_references for delete using (auth.uid() = user_id);
