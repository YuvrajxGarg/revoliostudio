-- Revolio Studio — fix infinite-recursion RLS bug introduced in 0025.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- 0025's "projects" SELECT policy checks project_members to see if you're a
-- member; project_members' own SELECT policy checked "projects" to see if
-- you're the owner. Each policy's EXISTS subquery re-triggers the other
-- table's RLS, so Postgres detects infinite recursion and every query
-- against `projects` or `generations` (whose new policy also touches
-- project_members) starts failing with a 500 — this is what caused "my
-- generations disappeared" after running 0025: the request errored out
-- before it ever reached your rows, nothing was deleted.
--
-- Fix: the ownership check moves into a SECURITY DEFINER function, which
-- runs with RLS bypassed internally (same pattern as add_project_owner_membership()
-- and search_profiles() already use) — so checking "am I this project's
-- owner" from inside project_members' policy no longer re-triggers projects'
-- own RLS, breaking the cycle.

create or replace function public.is_project_owner(target_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project_id and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_project_owner(uuid) from public;
grant execute on function public.is_project_owner(uuid) to authenticated;

drop policy if exists "members see their memberships" on public.project_members;
create policy "members see their memberships"
  on public.project_members for select
  using (auth.uid() = user_id or public.is_project_owner(project_id));

drop policy if exists "owners add members" on public.project_members;
create policy "owners add members"
  on public.project_members for insert
  with check (public.is_project_owner(project_id));

drop policy if exists "owners remove members or members leave" on public.project_members;
create policy "owners remove members or members leave"
  on public.project_members for delete
  using (auth.uid() = user_id or public.is_project_owner(project_id));

-- "projects" and "generations" policies from 0025 are unchanged — they
-- already just query project_members normally, which no longer loops back.
