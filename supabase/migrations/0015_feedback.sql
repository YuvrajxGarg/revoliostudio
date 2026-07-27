-- Revolio Studio — user feedback: feature/resource requests and bug reports
-- (with optional screenshot). Run in the Supabase SQL editor.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('feature','resource','bug')),
  body text not null,
  image_url text,
  page text,
  status text not null default 'open' check (status in ('open','done','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "users insert own feedback" on public.feedback;
create policy "users insert own feedback"
  on public.feedback for insert with check (auth.uid() = user_id);
drop policy if exists "users read own feedback" on public.feedback;
create policy "users read own feedback"
  on public.feedback for select using (auth.uid() = user_id);
drop policy if exists "admins read all feedback" on public.feedback;
create policy "admins read all feedback"
  on public.feedback for select using (public.is_admin());
drop policy if exists "admins update feedback" on public.feedback;
create policy "admins update feedback"
  on public.feedback for update using (public.is_admin());
drop policy if exists "admins delete feedback" on public.feedback;
create policy "admins delete feedback"
  on public.feedback for delete using (public.is_admin());
