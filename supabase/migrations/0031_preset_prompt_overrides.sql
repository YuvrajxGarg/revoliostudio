-- Revolio Studio — admin-editable overrides for the hardcoded `prompt`
-- field on curated Featured Templates (`PRESET_TEMPLATES` in
-- src/lib/presets.ts, 178 static entries). Presets themselves stay in code
-- (they're paired with icons/settings/preview assets that don't need to be
-- editable), but the prompt text is the one field admins want to tune
-- in-place when they find a better wording/combination — this table stores
-- just that override, keyed by the preset's stable string id, and is merged
-- over the static array at read time rather than replacing it.
--
-- Sparse by design: a preset with no row here just uses its original
-- hardcoded prompt. Deleting a row resets it back to that original.

create table if not exists public.preset_prompt_overrides (
  preset_id text primary key,
  prompt text not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.preset_prompt_overrides enable row level security;

-- Every signed-in user needs to read the effective prompt (it's applied the
-- moment anyone clicks "Use template"), but only admins may write.
drop policy if exists "authenticated users read preset prompt overrides" on public.preset_prompt_overrides;
create policy "authenticated users read preset prompt overrides"
  on public.preset_prompt_overrides for select using (auth.role() = 'authenticated');

drop policy if exists "admins upsert preset prompt overrides" on public.preset_prompt_overrides;
create policy "admins upsert preset prompt overrides"
  on public.preset_prompt_overrides for insert with check (public.is_admin());

drop policy if exists "admins update preset prompt overrides" on public.preset_prompt_overrides;
create policy "admins update preset prompt overrides"
  on public.preset_prompt_overrides for update using (public.is_admin());

drop policy if exists "admins delete preset prompt overrides" on public.preset_prompt_overrides;
create policy "admins delete preset prompt overrides"
  on public.preset_prompt_overrides for delete using (public.is_admin());
