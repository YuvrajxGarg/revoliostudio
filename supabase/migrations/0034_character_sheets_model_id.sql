-- Character Sheet now lets the user pick which face-consistency model runs
-- the 24-shot (now customizable, 8-12+) catalog — see
-- src/lib/characterSheetModels.ts. Recording which one was actually used is
-- just useful record-keeping (shown alongside cost), nullable since it's
-- optional metadata, not something anything else joins/filters on.
alter table public.character_sheets
  add column if not exists model_id text;
