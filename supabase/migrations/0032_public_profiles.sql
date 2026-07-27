-- 0032_public_profiles.sql
-- Revolio Studio — public profiles: username/bio/role, admin-only role
-- assignment, and public lookup RPCs for the /u/[username] page + Community
-- feed author attribution. Run in the Supabase SQL editor (or `supabase db
-- push`).

-- ── profiles: new columns ────────────────────────────────────────────────
-- username is stored lowercase-only (enforced by the format check below) so
-- uniqueness is a plain unique index — no citext extension needed, and no
-- risk of "Yuvraj" and "yuvraj" existing as two visually-identical rows.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists role text;

-- 3-20 chars, lowercase letters/digits/underscore, must start with a letter
-- (keeps it an unambiguous URL segment, and never collides with a bare
-- numeric id).
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,19}$');

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 300);

-- Fixed set of company roles — slugs, not free text. Adding a new role is a
-- migration, matching product's intent of a small, deliberately-closed set.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role is null or role in ('strategist', 'designer', 'producer', 'video_editor', 'founder'));

create unique index if not exists profiles_username_idx on public.profiles (username);

-- ── username generation helpers ──────────────────────────────────────────
-- Turns an email's local-part into a valid username seed: lowercase,
-- non-[a-z0-9_] chars collapsed to '_', any leading non-letter chars
-- stripped (format requires starting with a letter), padded if too short.
-- Never raises — always returns *something* usable as a seed.
create or replace function public.slugify_username_seed(raw text)
returns text as $$
declare
  seed text;
begin
  seed := lower(split_part(coalesce(raw, ''), '@', 1));
  seed := regexp_replace(seed, '[^a-z0-9_]', '_', 'g');
  seed := regexp_replace(seed, '^[^a-z]+', '', 'g');
  if seed is null or length(seed) = 0 then
    seed := 'user';
  end if;
  if length(seed) < 3 then
    seed := seed || 'usr';
  end if;
  return substring(seed from 1 for 20);
end;
$$ language plpgsql immutable;

-- Appends "2", "3", ... until free; after 50 attempts falls back to a random
-- 4-digit suffix so this can never loop forever. Only ever called from
-- SECURITY DEFINER contexts below (handle_new_user, the backfill block), so
-- it never runs under a caller's own limited privileges.
create or replace function public.generate_unique_username(base text)
returns text as $$
declare
  candidate text;
  i int := 0;
begin
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    if i > 50 then
      candidate := substring(base from 1 for 14) || '_' || floor(random() * 9000 + 1000)::int;
      exit;
    end if;
    candidate := substring(base from 1 for greatest(1, 19 - length(i::text))) || i::text;
  end loop;
  return candidate;
end;
$$ language plpgsql;

-- ── backfill existing users ──────────────────────────────────────────────
-- Every existing profile gets a stable, unique, auto-generated username so
-- /u/[username] always resolves and the Community feed can always link an
-- author. Ordered by created_at so the earliest signups keep the
-- "cleanest" (unsuffixed) slug where two emails collide on the same seed.
do $$
declare
  r record;
begin
  for r in select id, email from public.profiles where username is null order by created_at asc loop
    update public.profiles
      set username = public.generate_unique_username(public.slugify_username_seed(r.email))
      where id = r.id;
  end loop;
end $$;

-- ── handle_new_user: also seed a username for new signups ───────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_admin, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.email = 'yuvraj@revolio.in',
    public.generate_unique_username(public.slugify_username_seed(new.email))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
-- (the on_auth_user_created trigger from 0001 already points at this
-- function by name — no trigger change needed.)

-- ── privileged-column guard: role & is_admin are admin-only ─────────────
-- The existing self-update policy is row-scoped only (`auth.uid() = id`)
-- with no column restriction, so any signed-in user could otherwise run
-- `update profiles set role = 'founder'` (or `is_admin = true`) on their own
-- row and have it pass RLS. This trigger closes that at the row-write level,
-- regardless of which policy let the UPDATE through, by rejecting a change
-- to either privileged column unless the *acting* session (auth.uid(), not
-- necessarily the row being written) is already an admin.
create or replace function public.guard_privileged_profile_columns()
returns trigger as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change role';
    end if;
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Only an admin can change is_admin';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute procedure public.guard_privileged_profile_columns();

-- ── RLS: explicit self-update check + admin-can-update-any-row ──────────
drop policy if exists "profiles are self-updatable" on public.profiles;
create policy "profiles are self-updatable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Needed so an admin can set a teammate's role from /admin — the existing
-- self-update policy only ever matched auth.uid() = id.
drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── admin_user_usage: surface username/role in the admin table ─────────
-- Appending new trailing columns onto 0007's definition (which added
-- total_cost_usd and dropped total_credits after 0001/0003) — required by
-- Postgres's CREATE OR REPLACE VIEW rule (existing column names/order/types
-- must be preserved exactly; new columns must go at the end).
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
  max(g.created_at) as last_generation_at,
  coalesce(sum(g.cost_usd), 0) as total_cost_usd,
  p.username,
  p.role
from public.profiles p
left join public.generations g on g.user_id = p.id
group by p.id;

-- ── public lookup RPCs (never expose email or is_admin) ──────────────────
create or replace function public.get_public_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  role text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.role, p.created_at
  from public.profiles p
  where p.username = lower(p_username)
  limit 1;
$$;

revoke all on function public.get_public_profile_by_username(text) from public;
grant execute on function public.get_public_profile_by_username(text) to anon, authenticated;

create or replace function public.get_public_profiles(p_user_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  role text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.role, p.created_at
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to anon, authenticated;
