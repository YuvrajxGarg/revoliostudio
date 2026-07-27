-- Revolio Studio — share a generation with another user
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── notifications: allow per-user targeting ─────────────────────────────
-- Previously every notification was a broadcast readable by every signed-in
-- user (the admin "Send notification" panel). Share notifications need to
-- reach exactly one person, so add an optional target column — null keeps
-- the existing broadcast behavior.
alter table public.notifications
  add column if not exists user_id uuid references public.profiles (id) on delete cascade;

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

-- Replace the old "any authenticated user can read every notification" read
-- policy — that was fine when every row was a public broadcast, but a
-- targeted share notification must only be visible to its recipient.
drop policy if exists "authenticated users read notifications" on public.notifications;

create policy "users read own or broadcast notifications"
  on public.notifications for select
  using (user_id is null or user_id = auth.uid());

-- Any signed-in user can send a notification targeted at a specific person
-- (used by the share flow below) — but NOT a broadcast; broadcasts stay
-- admin-only via the existing "admins insert notifications" policy.
create policy "users send targeted notifications"
  on public.notifications for insert
  with check (auth.uid() = created_by and user_id is not null);

-- ── shared_generations ───────────────────────────────────────────────────
create table if not exists public.shared_generations (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (generation_id, to_user_id)
);

create index if not exists shared_generations_to_user_idx
  on public.shared_generations (to_user_id, created_at desc);
create index if not exists shared_generations_from_user_idx
  on public.shared_generations (from_user_id, created_at desc);

alter table public.shared_generations enable row level security;

-- Only the owner of the generation being shared can create the share row.
create policy "users share own generations"
  on public.shared_generations for insert
  with check (
    auth.uid() = from_user_id
    and exists (
      select 1 from public.generations g
      where g.id = generation_id and g.user_id = auth.uid()
    )
  );

-- Either side of a share can see the row (sender: "who did I share this
-- with"; receiver: "who shared this with me").
create policy "users read own shares"
  on public.shared_generations for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- The receiver can remove a share from their own "Shared" tab without
-- touching the underlying generation or the sender's copy.
create policy "receiver can unshare"
  on public.shared_generations for delete
  using (auth.uid() = to_user_id);

-- ── generations: allow reading rows shared with you ─────────────────────
create policy "users read generations shared with them"
  on public.generations for select
  using (
    exists (
      select 1 from public.shared_generations sg
      where sg.generation_id = generations.id and sg.to_user_id = auth.uid()
    )
  );

-- ── profiles: allow reading the other side of a share ───────────────────
-- Lets a receiver show "Shared by <name>" and a sender show who they shared
-- with, without opening up the profiles table to every authenticated user.
create policy "users read profiles connected via shares"
  on public.profiles for select
  using (
    exists (
      select 1 from public.shared_generations sg
      where (sg.from_user_id = profiles.id and sg.to_user_id = auth.uid())
         or (sg.to_user_id = profiles.id and sg.from_user_id = auth.uid())
    )
  );

-- ── search_profiles: recipient picker for the Share dialog ──────────────
-- SECURITY DEFINER so the search can match against every profile (needed to
-- find someone you haven't shared anything with yet) without granting a
-- blanket "read all profiles" policy. Only ever returns non-sensitive
-- display fields — never is_admin or anything added later.
create or replace function public.search_profiles(search_query text)
returns table (id uuid, email text, display_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.email, p.display_name, p.avatar_url
  from public.profiles p
  where p.id <> auth.uid()
    and (
      search_query = '' or
      p.email ilike '%' || search_query || '%' or
      p.display_name ilike '%' || search_query || '%'
    )
  order by p.display_name nulls last, p.email
  limit 20;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;
