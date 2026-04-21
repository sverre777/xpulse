-- Fase 12: Plan-felter på konkurranse (mål + før-kommentar).
-- Plan-modus samler intensjon; Dagbok-modus samler refleksjon i det
-- eksisterende comment-feltet.

alter table public.workout_competition_data
  add column if not exists goal        text,
  add column if not exists pre_comment text;

notify pgrst, 'reload schema';
