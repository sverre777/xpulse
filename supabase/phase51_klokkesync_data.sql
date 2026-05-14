-- Fase 51 — Per-lap-data og workout-metadata fra klokke-import.
--
-- Fyller på workout_activities med felter Strava/.fit gir oss men vi
-- ikke utnytter enda: maks-puls, watt, pace, cadence, høydemeter, RPE
-- og lap-notater. workouts får suffer-score, kalorier og temperatur.
-- workout_samples får temperatur og akkumulert distanse.
--
-- Idempotent.

alter table public.workout_activities
  add column if not exists max_hr           integer,
  add column if not exists avg_watts        numeric(6,1),
  add column if not exists max_watts        numeric(6,1),
  add column if not exists avg_speed_ms     numeric(6,3),
  add column if not exists max_speed_ms     numeric(6,3),
  add column if not exists avg_cadence      numeric(5,1),
  add column if not exists max_cadence      numeric(5,1),
  add column if not exists rpe              integer
    check (rpe is null or (rpe between 1 and 10)),
  add column if not exists lap_notes        text;

alter table public.workouts
  add column if not exists suffer_score     integer,
  add column if not exists calories         integer;
-- temperature_c finnes allerede i workouts (audit fant feltet)

alter table public.workout_samples
  add column if not exists temperature_samples jsonb,
  add column if not exists distance_samples    jsonb;

notify pgrst, 'reload schema';
