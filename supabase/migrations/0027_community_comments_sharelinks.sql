-- Revolio Studio — Community feed (opt-in publish), comments, and public
-- token share links. Run in the Supabase SQL editor (or `supabase db push`).

-- ── generations: opt-in publishing ──────────────────────────────────────
-- A generation is private by default; the owner explicitly publishes it to
-- the public Explore feed. published_at also gives the feed a stable sort.
alter table public.generations
  add column if not exists is_public boolean not null default false;
alter table public.generations
  add column if not exists published_at timestamptz;

create index if not exists generations_public_idx
  on public.generations (published_at desc)
  where is_public;

-- Anyone (even signed-out) may read a published, non-deleted generation. This
-- is additive to the existing owner-scoped select policy — Postgres RLS ORs
-- policies together, so owners still see all their own rows.
drop policy if exists "anyone reads published generations" on public.generations;
create policy "anyone reads published generations"
  on public.generations for select
  to anon, authenticated
  using (is_public = true and deleted_at is null);

-- ── generation_comments ─────────────────────────────────────────────────
create table if not exists public.generation_comments (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists generation_comments_gen_idx
  on public.generation_comments (generation_id, created_at);

alter table public.generation_comments enable row level security;

-- You can read comments on a generation you can see: your own generation, a
-- teammate's via a shared team project, or any published one.
drop policy if exists "read comments on visible generations" on public.generation_comments;
create policy "read comments on visible generations"
  on public.generation_comments for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.generations g
      where g.id = generation_id
        and (
          g.is_public = true
          or g.user_id = auth.uid()
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = g.project_id and pm.user_id = auth.uid()
          )
        )
    )
  );

-- Signed-in users can comment on a generation they can see, as themselves.
drop policy if exists "insert own comments" on public.generation_comments;
create policy "insert own comments"
  on public.generation_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.generations g
      where g.id = generation_id
        and (
          g.is_public = true
          or g.user_id = auth.uid()
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = g.project_id and pm.user_id = auth.uid()
          )
        )
    )
  );

-- Delete your own comment (or the generation owner can moderate theirs).
drop policy if exists "delete own or owned-generation comments" on public.generation_comments;
create policy "delete own or owned-generation comments"
  on public.generation_comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.generations g where g.id = generation_id and g.user_id = auth.uid())
  );

-- ── generation_share_links (public token links) ─────────────────────────
create table if not exists public.generation_share_links (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists generation_share_links_gen_idx
  on public.generation_share_links (generation_id);

alter table public.generation_share_links enable row level security;

-- The owner manages their own links.
drop policy if exists "owner manages share links" on public.generation_share_links;
create policy "owner manages share links"
  on public.generation_share_links for all
  to authenticated
  using (exists (select 1 from public.generations g where g.id = generation_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.generations g where g.id = generation_id and g.user_id = auth.uid()));

-- Public read of a shared generation by token, regardless of RLS on the row
-- itself — SECURITY DEFINER so a token holder can view a private generation
-- that was explicitly shared, without exposing anything else.
create or replace function public.get_shared_generation(share_token text)
returns public.generations
language sql
security definer
set search_path = public
as $$
  select g.*
  from public.generations g
  join public.generation_share_links l on l.generation_id = g.id
  where l.token = share_token and g.deleted_at is null
  limit 1;
$$;

grant execute on function public.get_shared_generation(text) to anon, authenticated;
