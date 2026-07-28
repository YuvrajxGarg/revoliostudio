-- Character Sheet's "Save character…" flow only ever persisted the source
-- face photo to user_references — the ~24 generated shots that made the
-- sheet useful in the first place were left stranded on the character_sheets
-- row alone, with no path back to them once you were just browsing Library.
-- This lets a saved character carry its generated shots along with it.
alter table public.user_references
  add column if not exists shot_urls jsonb not null default '[]'::jsonb;
