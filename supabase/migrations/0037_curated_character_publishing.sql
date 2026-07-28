-- Lets a signed-in user "publish" one of their own saved characters
-- (user_references, category "character") into the shared curated_references
-- table, so it shows up for every user under Library's "By Revolio" tab —
-- previously that table was strictly admin-authored (see 0024's insert
-- policy). Scoped tightly: only category='character' rows, only inserted/
-- deleted by their own creator — every other curated category (style,
-- location, element, camera, effects, color) stays admin-only exactly as
-- before, since these two new policies are additive (Postgres RLS ORs
-- multiple permissive policies for the same command together).

alter table public.curated_references
  add column if not exists shot_urls jsonb not null default '[]'::jsonb,
  add column if not exists poster_url text;

alter table public.user_references
  add column if not exists published_curated_id uuid references public.curated_references (id) on delete set null;

drop policy if exists "users publish own characters" on public.curated_references;
create policy "users publish own characters"
  on public.curated_references for insert
  with check (category = 'character' and created_by = auth.uid());

drop policy if exists "users unpublish own characters" on public.curated_references;
create policy "users unpublish own characters"
  on public.curated_references for delete
  using (category = 'character' and created_by = auth.uid());
