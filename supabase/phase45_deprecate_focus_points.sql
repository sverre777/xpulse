-- Fase 45 — Markér focus_points som deprecated.
--
-- Fokus-punkter overlappet med uke-/måned-/periode-notatene + trener-
-- kommentarene. UI-mountene er fjernet 2026-04-28 i Plan, Dagbok og
-- Oversikt. Tabellen og dataene beholdes for backward compat fram til
-- neste lansering, deretter vurderes sletting (egen migrering) hvis
-- ingen avhengigheter er funnet.
--
-- Idempotent.

comment on table public.focus_points is
  'DEPRECATED 2026-04-28: Fokus-punkter erstattet av enkelt notat (period_notes) + trener-kommentar (coach_comments). UI fjernet. Slettes etter neste lansering hvis ingen avhengigheter.';

notify pgrst, 'reload schema';
