-- Fase 53b — Tid per styrke-sett.
--
-- Quick fix: bruker kan registrere tid (sekunder) per sett i tillegg til
-- eller i stedet for reps/kg. Eksempel: planke 90 sek, isometriske hold,
-- statisk muskeldraining.
--
-- Tabellen ligger i workout_activity_exercise_sets (phase7_1).
-- Idempotent.

alter table public.workout_activity_exercise_sets
  add column if not exists duration_seconds integer
    check (duration_seconds is null or duration_seconds > 0);

notify pgrst, 'reload schema';
