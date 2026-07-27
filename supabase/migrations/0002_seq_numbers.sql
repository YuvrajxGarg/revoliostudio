-- Revolio Studio — per-user sequential generation numbers
-- Powers "revoliostudio_001" style display names / download filenames.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table public.generations
  add column if not exists seq_number integer;

create table if not exists public.user_generation_counters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  next_seq integer not null default 1
);

-- Enabled with zero client-facing policies on purpose: the only writers/
-- readers of this table are next_generation_seq() and
-- assign_generation_seq() below, both SECURITY DEFINER, which bypass RLS.
-- No anon/authenticated key should ever query this table directly.
alter table public.user_generation_counters enable row level security;

-- Atomically claim the next sequence number for a user.
create or replace function public.next_generation_seq(uid uuid)
returns integer as $$
declare
  n integer;
begin
  insert into public.user_generation_counters (user_id, next_seq)
  values (uid, 2)
  on conflict (user_id) do update set next_seq = public.user_generation_counters.next_seq + 1
  returning next_seq - 1 into n;
  return n;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.assign_generation_seq()
returns trigger as $$
begin
  if new.seq_number is null then
    new.seq_number := public.next_generation_seq(new.user_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists generations_assign_seq on public.generations;
create trigger generations_assign_seq
  before insert on public.generations
  for each row execute procedure public.assign_generation_seq();

-- Backfill: number existing rows per user in creation order, then seed the
-- counters table so new inserts continue after the highest existing number.
with numbered as (
  select id, user_id, row_number() over (partition by user_id order by created_at asc) as rn
  from public.generations
  where seq_number is null
)
update public.generations g
set seq_number = numbered.rn
from numbered
where g.id = numbered.id;

insert into public.user_generation_counters (user_id, next_seq)
select user_id, coalesce(max(seq_number), 0) + 1
from public.generations
group by user_id
on conflict (user_id) do update set next_seq = greatest(
  public.user_generation_counters.next_seq,
  excluded.next_seq
);
