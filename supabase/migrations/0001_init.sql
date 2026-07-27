-- Revolio Studio — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER so this lookup bypasses RLS — prevents infinite recursion
-- when used inside a policy defined on public.profiles itself.
create or replace function public.is_admin()
returns boolean as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$ language sql security definer stable set search_path = public;


create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

create policy "admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles are self-updatable"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up via Google.
-- yuvraj@revolio.in is granted admin automatically; everyone else defaults false.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.email = 'yuvraj@revolio.in'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── generations ──────────────────────────────────────────────────────────
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('image', 'video', '3d')),
  mode text not null,                 -- t2i | i2i | t2v | i2v | flf | omni | t23d | i23d
  model_id text not null,             -- internal registry key, e.g. 'nano-banana-pro'
  model_label text not null,          -- display name, e.g. 'Nano Banana Pro'
  endpoint text not null,             -- muapi endpoint slug actually called
  prompt text not null default '',
  reference_urls text[] not null default '{}',
  start_frame_url text,
  end_frame_url text,
  settings jsonb not null default '{}'::jsonb,   -- aspect_ratio, duration, num_images, seed, etc.
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  request_id text,
  output_urls text[] not null default '{}',
  thumbnail_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);

create index if not exists generations_status_idx
  on public.generations (status) where status in ('queued', 'processing');

alter table public.generations enable row level security;

create policy "users read own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "users insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "users update own generations"
  on public.generations for update
  using (auth.uid() = user_id);

create policy "admins read all generations"
  on public.generations for select
  using (public.is_admin());

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists generations_touch_updated_at on public.generations;
create trigger generations_touch_updated_at
  before update on public.generations
  for each row execute procedure public.touch_updated_at();

-- ── storage ──────────────────────────────────────────────────────────────
-- Public bucket for reference images, start/end frames, and pasted uploads.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "authenticated users upload media"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');

create policy "anyone can read media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "users delete own media"
  on storage.objects for delete
  using (bucket_id = 'media' and owner = auth.uid());

-- ── admin usage view ────────────────────────────────────────────────────
create or replace view public.admin_user_usage as
select
  p.id as user_id,
  p.email,
  p.display_name,
  p.avatar_url,
  p.is_admin,
  p.created_at as joined_at,
  count(g.id) as total_generations,
  count(g.id) filter (where g.category = 'image') as image_generations,
  count(g.id) filter (where g.category = 'video') as video_generations,
  count(g.id) filter (where g.category = '3d') as model_3d_generations,
  count(g.id) filter (where g.status = 'failed') as failed_generations,
  max(g.created_at) as last_generation_at
from public.profiles p
left join public.generations g on g.user_id = p.id
group by p.id;
