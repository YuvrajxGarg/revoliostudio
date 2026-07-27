-- Revolio Studio — Orbit: real-time collaborative infinite canvas
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Every board has an owner and a set of members (owner included, seeded by
-- the trigger below). Membership is what every downstream policy checks —
-- keeping "is this person allowed to touch this board" in one helper avoids
-- repeating an owner-OR-member OR clause on every single table.
--
-- Realtime sync happens two ways: persisted state (nodes/edges/board rows)
-- goes through Postgres Changes (added to the supabase_realtime publication
-- below), which is durable and correct but has normal Postgres write
-- latency — fine for "a node was created/moved/deleted". Live cursor
-- positions and in-progress drags use a separate ephemeral Realtime
-- Broadcast channel (`orbit-board-{id}`, set up client-side, no table
-- involved) since persisting every mousemove to Postgres would be wasteful
-- and slow.

-- ── orbit_boards ─────────────────────────────────────────────────────────
create table if not exists public.orbit_boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Untitled board',
  -- When true, any signed-in Revolio user who opens /orbit/{id} (i.e. has
  -- the link) can join as an editor via orbit_join_board() below — this IS
  -- the "invite link" mechanism, there's no separate token.
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orbit_boards_owner_idx on public.orbit_boards (owner_id, updated_at desc);

alter table public.orbit_boards enable row level security;

-- ── orbit_board_members ──────────────────────────────────────────────────
create table if not exists public.orbit_board_members (
  board_id uuid not null references public.orbit_boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists orbit_board_members_user_idx on public.orbit_board_members (user_id);

alter table public.orbit_board_members enable row level security;

-- SECURITY DEFINER so board/node/edge policies can check membership without
-- RLS recursion (a plain subquery against orbit_board_members from within
-- orbit_board_members' own policy would recurse).
create or replace function public.is_orbit_board_member(target_board_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.orbit_board_members m
    where m.board_id = target_board_id and m.user_id = auth.uid()
  );
$$;

-- Seed the owner as a member row automatically — every other policy in this
-- file only ever checks membership, never owner_id directly.
create or replace function public.orbit_seed_owner_membership()
returns trigger as $$
begin
  insert into public.orbit_board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (board_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists orbit_boards_seed_owner on public.orbit_boards;
create trigger orbit_boards_seed_owner
  after insert on public.orbit_boards
  for each row execute procedure public.orbit_seed_owner_membership();

-- Lets someone who only has a board's id (from a shared link) join it —
-- checks is_public itself (SECURITY DEFINER bypasses RLS internally), so
-- the caller never needs standing SELECT access on orbit_boards first.
create or replace function public.orbit_join_board(target_board_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.orbit_boards where id = target_board_id and is_public) then
    insert into public.orbit_board_members (board_id, user_id, role)
    values (target_board_id, auth.uid(), 'editor')
    on conflict (board_id, user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.orbit_join_board(uuid) from public;
grant execute on function public.orbit_join_board(uuid) to authenticated;

-- boards
drop policy if exists "members read boards" on public.orbit_boards;
create policy "members read boards"
  on public.orbit_boards for select
  using (public.is_orbit_board_member(id));

drop policy if exists "users create boards" on public.orbit_boards;
create policy "users create boards"
  on public.orbit_boards for insert
  with check (auth.uid() = owner_id);

drop policy if exists "owner updates board" on public.orbit_boards;
create policy "owner updates board"
  on public.orbit_boards for update
  using (auth.uid() = owner_id);

drop policy if exists "owner deletes board" on public.orbit_boards;
create policy "owner deletes board"
  on public.orbit_boards for delete
  using (auth.uid() = owner_id);

-- keep updated_at fresh (reuses the shared trigger fn from 0001_init.sql)
drop trigger if exists orbit_boards_touch_updated_at on public.orbit_boards;
create trigger orbit_boards_touch_updated_at
  before update on public.orbit_boards
  for each row execute procedure public.touch_updated_at();

-- members
drop policy if exists "members read board members" on public.orbit_board_members;
create policy "members read board members"
  on public.orbit_board_members for select
  using (public.is_orbit_board_member(board_id));

drop policy if exists "member leaves board" on public.orbit_board_members;
create policy "member leaves board"
  on public.orbit_board_members for delete
  using (auth.uid() = user_id and role <> 'owner');

-- ── orbit_nodes ──────────────────────────────────────────────────────────
-- One row per canvas object — sticky note, text block, image, link/embed
-- card, video embed, table, shape, or sticker. `data` carries everything
-- specific to that type (text content, image url, embed url + og-preview
-- fields, table rows, shape kind + fill color, sticker id, etc.) so adding
-- a new node type later never needs a migration.
create table if not exists public.orbit_nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.orbit_boards (id) on delete cascade,
  type text not null check (type in ('text', 'sticky', 'image', 'link', 'video', 'table', 'shape', 'sticker', 'frame')),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 240,
  height double precision not null default 160,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orbit_nodes_board_idx on public.orbit_nodes (board_id);

alter table public.orbit_nodes enable row level security;

drop policy if exists "members read nodes" on public.orbit_nodes;
create policy "members read nodes"
  on public.orbit_nodes for select
  using (public.is_orbit_board_member(board_id));

drop policy if exists "members insert nodes" on public.orbit_nodes;
create policy "members insert nodes"
  on public.orbit_nodes for insert
  with check (public.is_orbit_board_member(board_id));

drop policy if exists "members update nodes" on public.orbit_nodes;
create policy "members update nodes"
  on public.orbit_nodes for update
  using (public.is_orbit_board_member(board_id));

drop policy if exists "members delete nodes" on public.orbit_nodes;
create policy "members delete nodes"
  on public.orbit_nodes for delete
  using (public.is_orbit_board_member(board_id));

drop trigger if exists orbit_nodes_touch_updated_at on public.orbit_nodes;
create trigger orbit_nodes_touch_updated_at
  before update on public.orbit_nodes
  for each row execute procedure public.touch_updated_at();

-- ── orbit_edges ──────────────────────────────────────────────────────────
-- Connectors between two nodes (FigJam-style arrows/lines).
create table if not exists public.orbit_edges (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.orbit_boards (id) on delete cascade,
  source_node_id uuid not null references public.orbit_nodes (id) on delete cascade,
  target_node_id uuid not null references public.orbit_nodes (id) on delete cascade,
  source_handle text,
  target_handle text,
  label text,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orbit_edges_board_idx on public.orbit_edges (board_id);

alter table public.orbit_edges enable row level security;

drop policy if exists "members read edges" on public.orbit_edges;
create policy "members read edges"
  on public.orbit_edges for select
  using (public.is_orbit_board_member(board_id));

drop policy if exists "members insert edges" on public.orbit_edges;
create policy "members insert edges"
  on public.orbit_edges for insert
  with check (public.is_orbit_board_member(board_id));

drop policy if exists "members update edges" on public.orbit_edges;
create policy "members update edges"
  on public.orbit_edges for update
  using (public.is_orbit_board_member(board_id));

drop policy if exists "members delete edges" on public.orbit_edges;
create policy "members delete edges"
  on public.orbit_edges for delete
  using (public.is_orbit_board_member(board_id));

-- ── realtime ─────────────────────────────────────────────────────────────
-- Postgres Changes on these three tables — every Supabase project ships
-- with a `supabase_realtime` publication by default. Guarded with a DO
-- block since `alter publication ... add table` errors (aborting the whole
-- script, since Supabase's SQL editor runs the pasted file as one implicit
-- transaction) if the table is already a member — which it will be on any
-- re-run of this migration.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_boards'
  ) then
    alter publication supabase_realtime add table public.orbit_boards;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_nodes'
  ) then
    alter publication supabase_realtime add table public.orbit_nodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orbit_edges'
  ) then
    alter publication supabase_realtime add table public.orbit_edges;
  end if;
end $$;
