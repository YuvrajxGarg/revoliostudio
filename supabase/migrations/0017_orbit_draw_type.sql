-- Revolio Studio — Orbit: allow the new "draw" node type (freehand pen tool)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- orbit_nodes.type has a check constraint enumerating every valid node
-- type; adding a new type means widening that constraint. Safe to re-run —
-- drops the constraint first if present, regardless of whether it was
-- already widened by a prior attempt.

alter table public.orbit_nodes drop constraint if exists orbit_nodes_type_check;

alter table public.orbit_nodes
  add constraint orbit_nodes_type_check
  check (type in ('text', 'sticky', 'image', 'link', 'video', 'table', 'shape', 'sticker', 'frame', 'draw'));
