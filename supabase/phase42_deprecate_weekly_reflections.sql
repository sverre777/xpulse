-- Fase 42 — Markér weekly_reflections som deprecated.
--
-- Refleksjons-skjemaet (perceived_load, energy, stress, comment, injury_notes)
-- duplikerte funksjonalitet med uke-/måned-/periode-notatene + trener-
-- kommentarene. UI-mountene er fjernet 2026-04-27. Tabellen og dataene
-- beholdes for backward compat fram til neste lansering, deretter vurderes
-- sletting (egen migrering) hvis ingen avhengigheter er funnet.
--
-- Idempotent: comment on table kan kjøres flere ganger.

comment on table public.weekly_reflections is
  'DEPRECATED 2026-04-27: Refleksjons-felt erstattet av enkelt notat (period_notes) + trener-kommentar (coach_comments). Slettes etter neste lansering hvis ingen avhengigheter.';

notify pgrst, 'reload schema';
