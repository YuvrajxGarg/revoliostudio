-- Revolio Studio — allow users to delete their own generations
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create policy "users delete own generations"
  on public.generations for delete
  using (auth.uid() = user_id);
