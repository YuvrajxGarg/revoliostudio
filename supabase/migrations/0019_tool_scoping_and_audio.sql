-- Revolio Studio — tool provenance + audio category
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Two independent fixes bundled together since both touch the same table:
--
-- 1. `category` check constraint only allowed ('image','video','3d') —
--    the newly-added Audio Generator (Suno/MMAudio models) has been
--    inserting rows with category='audio' since it shipped, which the
--    constraint silently rejects. Widen it.
--
-- 2. Config-driven single-purpose tool studios (Sticker Pack Generator,
--    Headshot Studio, Relight, etc. — see src/lib/toolStudios.ts) reuse the
--    same underlying muapi models as the plain Image/Video Generator (there
--    are no dedicated "sticker" or "headshot" models). Their galleries were
--    scoped purely by model_id, so any generation made with a shared model
--    (e.g. gpt-image-2) showed up in EVERY tool that also uses that model,
--    including the plain Image Generator — reported directly: "images from
--    normal image generations show up in sticker pack". Add a nullable
--    `tool_id` column that tags which tool actually created each row (null
--    = the plain Image/Video/Audio/3D studio) so each surface can filter to
--    exactly its own generations going forward.

alter table public.generations
  drop constraint if exists generations_category_check;

alter table public.generations
  add constraint generations_category_check
  check (category in ('image', 'video', '3d', 'audio'));

alter table public.generations
  add column if not exists tool_id text;

comment on column public.generations.tool_id is
  'Slug of the config-driven tool studio that created this row (see src/lib/toolStudios.ts ids, e.g. "stickers", "headshot", "relight") — null for the plain Image/Video/Audio/3D Generator.';

-- Existing rows predate this column and have no way to be retroactively
-- attributed to a tool — they stay null, which correctly buckets them with
-- the plain studios rather than incorrectly with (or split across) any
-- tool studio.

create index if not exists generations_user_tool_idx
  on public.generations (user_id, tool_id, category, created_at desc);
