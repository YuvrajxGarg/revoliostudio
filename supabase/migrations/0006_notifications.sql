-- Revolio Studio — admin-broadcast notifications
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

alter table public.notifications enable row level security;

-- Every signed-in user can read the broadcast list (there's no per-user
-- targeting — all notifications go to everyone).
create policy "authenticated users read notifications"
  on public.notifications for select
  using (auth.role() = 'authenticated');

create policy "admins insert notifications"
  on public.notifications for insert
  with check (public.is_admin());

create policy "admins delete notifications"
  on public.notifications for delete
  using (public.is_admin());

-- ── notification_reads ──────────────────────────────────────────────────
-- Per-user "seen" receipts. A notification popup is only ever shown once
-- per user: the moment it's shown (or the inbox is opened), the client
-- writes a row here, and any future page load excludes already-read ids
-- from the popup queue.
create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notification_reads enable row level security;

create policy "users manage own notification reads"
  on public.notification_reads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
