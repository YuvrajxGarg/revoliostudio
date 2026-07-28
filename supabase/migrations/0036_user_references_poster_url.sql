-- Character Sheet's composited poster (characterSheetCompositor.ts) only
-- ever existed as a client-side canvas blob — downloadable in the moment,
-- but gone the second you left the page, and Library had nothing to show but
-- the plain source face photo. This persists the poster to Storage so a
-- saved character's card can preview the actual sheet, not just the face.
alter table public.user_references
  add column if not exists poster_url text;
