-- Revolio Studio — Trash (soft-delete), Favorites, and real Team projects.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── projects: type + soft-delete ────────────────────────────────────────
alter table public.projects
  add column if not exists type text not null default 'personal' check (type in ('personal', 'team'));
alter table public.projects
  add column if not exists deleted_at timestamptz;

create index if not exists projects_deleted_idx on public.projects (user_id, deleted_at);

-- ── generations: soft-delete + favorites ────────────────────────────────
alter table public.generations
  add column if not exists deleted_at timestamptz;
alter table public.generations
  add column if not exists is_favorite boolean not null default false;

create index if not exists generations_deleted_idx on public.generations (user_id, deleted_at);
create index if not exists generations_favorite_idx on public.generations (user_id, is_favorite) where is_favorite;

-- ── project_members ──────────────────────────────────────────────────────
-- Real collaboration for "team" projects: every accepted member can see the
-- project and every generation filed under it, not just the creator. There's
-- no email-invite/notification pipeline here — "inviting" someone looks them
-- up by email/name among existing Revolio users (same search_profiles() RPC
-- the Share dialog already uses) and adds them directly, same as sharing a
-- single generation already works in this app. A person who doesn't have a
-- Revolio account yet can't be invited until they sign up.
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

drop policy if exists "members see their memberships" on public.project_members;
create policy "members see their memberships"
  on public.project_members for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists "owners add members" on public.project_members;
create policy "owners add members"
  on public.project_members for insert
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

drop policy if exists "owners remove members or members leave" on public.project_members;
create policy "owners remove members or members leave"
  on public.project_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- Auto-add a project's creator as its 'owner' member row so team-visibility
-- checks (below) work uniformly for the creator too, without special-casing
-- "user_id = projects.user_id OR exists in project_members" everywhere.
create or replace function public.add_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role, added_by)
  values (new.id, new.user_id, 'owner', new.user_id)
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created_add_owner on public.projects;
create trigger on_project_created_add_owner
  after insert on public.projects
  for each row execute function public.add_project_owner_membership();

-- ── projects: let accepted members see the project row, not just the owner ─
drop policy if exists "users read own projects" on public.projects;
drop policy if exists "users read own or member projects" on public.projects;
create policy "users read own or member projects"
  on public.projects for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())
  );
-- Insert/update/delete stay owner-only (see existing 0014 policies) — a
-- member can see and contribute generations to a team project but can't
-- rename/retype/delete the project itself or remove other members; only the
-- creator can. This keeps the RLS surface small for now — a real role-based
-- permission split (editor vs viewer) can layer on top of the `role` column
-- already stored on project_members without another migration.

-- ── generations: let team members read each other's rows on a shared
-- project ─────────────────────────────────────────────────────────────────
-- Insert doesn't need a new policy: "users insert own generations" (0001)
-- already permits any auth.uid() = user_id insert regardless of project_id,
-- so filing a new generation into a team project you're a member of already
-- works today — this migration only needs to open up SELECT so a teammate
-- can see generations *someone else* filed there.
drop policy if exists "team members read project generations" on public.generations;
create policy "team members read project generations"
  on public.generations for select
  using (
    project_id is not null
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = generations.project_id and pm.user_id = auth.uid()
    )
  );
